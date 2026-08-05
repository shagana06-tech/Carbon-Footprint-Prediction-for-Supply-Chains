import { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CalculationResult } from '../models/calculationResult.model';
import { ExplainabilityResult } from '../models/explainabilityResult.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * GET /api/ai/insights?period=YYYY-MM
 * Returns Gemini-powered AI insights based on the company's emission data.
 */
export const getAiInsights = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { period } = req.query;

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Missing company scoping' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'ConfigurationError', detail: 'Gemini API key is not configured on the server.' });
    }

    // 1. Fetch latest calculation result (period-specific or most recent)
    let calcQuery: any = { companyId };
    if (period) calcQuery.period = period;

    const calc = period
      ? await CalculationResult.findOne(calcQuery)
      : await CalculationResult.findOne(calcQuery).sort({ period: -1 });

    // 2. Fetch all trend data for context
    const trends = await CalculationResult.find({ companyId }).sort({ period: 1 });

    // 3. Fetch explainability data
    let explainData = null;
    if (calc) {
      explainData = await ExplainabilityResult.findOne({ calculationResultId: calc._id });
    }

    if (!calc && trends.length === 0) {
      return res.status(200).json({
        insights: [
          {
            type: 'info',
            title: 'No Data Available',
            content: 'No emissions data found. Please add activity entries in the Data Entry section to generate AI-powered insights.',
            icon: 'info'
          }
        ],
        generatedAt: new Date().toISOString(),
        model: 'gemini-fallback'
      });
    }

    // 4. Build a rich prompt with the emissions data
    const totalMt = calc ? (calc.totalKg / 1000).toFixed(2) : 'N/A';
    const scope1Mt = calc ? (calc.scope1Kg / 1000).toFixed(2) : 'N/A';
    const scope2Mt = calc ? (calc.scope2Kg / 1000).toFixed(2) : 'N/A';
    const scope3Mt = calc ? (calc.scope3Kg / 1000).toFixed(2) : 'N/A';
    const correctionDelta = calc
      ? ((calc.correctedTotalKg - calc.baselineTotalKg) / 1000).toFixed(2)
      : '0';

    const trendSummary = trends.map(t => `${t.period}: ${(t.totalKg / 1000).toFixed(2)} t CO2e`).join(', ');

    const breakdownSummary = calc?.breakdown
      ? calc.breakdown.map(b => `${b.activityType}: ${(b.kg / 1000).toFixed(2)}t (${b.pct.toFixed(1)}%)`).join(', ')
      : 'No breakdown available';

    const shapSummary = explainData?.topFactors
      ? explainData.topFactors.map(f => `${f.feature}: ${f.contributionPct.toFixed(1)}% - ${f.plainLanguage}`).join(' | ')
      : 'SHAP data not available';

    const prompt = `You are an expert carbon emissions analyst AI assistant. Analyze the following corporate supply chain emissions data and provide 4 concise, actionable insights.

CURRENT PERIOD: ${period || calc?.period || 'Latest'}
EMISSIONS DATA:
- Total Footprint: ${totalMt} metric tons CO2e
- Scope 1 (Direct/Fuel): ${scope1Mt} t CO2e
- Scope 2 (Energy/Grid): ${scope2Mt} t CO2e  
- Scope 3 (Supply Chain): ${scope3Mt} t CO2e
- ML Correction Delta: ${correctionDelta} t CO2e (positive = higher than baseline)
- Category Breakdown: ${breakdownSummary}

HISTORICAL TREND (most recent periods): ${trendSummary || 'No trend data'}

ML MODEL SHAP FACTORS: ${shapSummary}

INSTRUCTIONS: Provide exactly 4 insights in valid JSON array format. Each insight must have:
- "type": one of "warning", "success", "tip", "alert"
- "title": short title (max 8 words)
- "content": detailed insight (2-3 sentences, specific, data-driven, actionable)
- "metric": a key number or percentage from the data (e.g., "23.4 t CO2e reduction potential")

Focus on: emission hotspots, reduction opportunities, scope 3 supply chain risks, compliance observations, and year-over-year trends.
Respond with ONLY a valid JSON array, no markdown, no explanation outside the array.`;

    // 5. Call Gemini API
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // 6. Parse response - extract JSON from response
    let insights;
    try {
      // Strip any markdown code fences if present
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      insights = JSON.parse(cleaned);
      if (!Array.isArray(insights)) {
        throw new Error('Response is not an array');
      }
    } catch (parseErr) {
      // Fallback: Return structured insights from the raw text
      insights = [
        {
          type: 'info',
          title: 'AI Analysis Generated',
          content: responseText.substring(0, 300) + (responseText.length > 300 ? '...' : ''),
          metric: `${totalMt} t CO2e total`
        }
      ];
    }

    return res.status(200).json({
      insights,
      context: {
        period: period || calc?.period,
        totalKg: calc?.totalKg || 0,
        trendsCount: trends.length
      },
      generatedAt: new Date().toISOString(),
      model: 'gemini-1.5-flash'
    });

  } catch (err: any) {
    console.error('Gemini AI insights error:', err.message);

    // If Gemini API fails, return smart rule-based insights from the data
    try {
      const companyId = req.user?.companyId;
      const { period } = req.query;
      let calcQuery: any = { companyId };
      if (period) calcQuery.period = period;
      const calc = period
        ? await CalculationResult.findOne(calcQuery)
        : await CalculationResult.findOne(calcQuery).sort({ period: -1 });
      const trends = await CalculationResult.find({ companyId }).sort({ period: 1 });

      const fallbackInsights = generateFallbackInsights(calc, trends);
      return res.status(200).json({
        insights: fallbackInsights,
        generatedAt: new Date().toISOString(),
        model: 'rule-based-fallback',
        fallbackReason: err.message
      });
    } catch {
      return res.status(500).json({ error: 'InternalServerError', detail: err.message });
    }
  }
};

/**
 * Rule-based fallback insights generator when Gemini API is unavailable.
 */
function generateFallbackInsights(calc: any, trends: any[]) {
  const insights: any[] = [];

  if (!calc) {
    return [{
      type: 'info',
      title: 'No Emissions Data Found',
      content: 'Start by adding activity entries in the Data Entry section. Once emissions are calculated, AI insights will be generated automatically.',
      metric: '0 t CO2e recorded'
    }];
  }

  const totalMt = (calc.totalKg / 1000).toFixed(2);
  const scope3Pct = calc.totalKg > 0 ? ((calc.scope3Kg / calc.totalKg) * 100).toFixed(1) : '0';
  const scope2Pct = calc.totalKg > 0 ? ((calc.scope2Kg / calc.totalKg) * 100).toFixed(1) : '0';
  const correctionDelta = ((calc.correctedTotalKg - calc.baselineTotalKg) / 1000).toFixed(2);

  // Scope 3 dominance warning
  if (calc.scope3Kg > calc.totalKg * 0.5) {
    insights.push({
      type: 'warning',
      title: 'Scope 3 Supply Chain Dominates',
      content: `Supply chain (Scope 3) accounts for ${scope3Pct}% of your total footprint. This indicates high dependency on upstream suppliers and freight partners. Consider supplier sustainability audits and shifting to rail freight.`,
      metric: `${scope3Pct}% Scope 3 share`
    });
  }

  // Grid electricity insight
  if (calc.scope2Kg > calc.totalKg * 0.2) {
    insights.push({
      type: 'tip',
      title: 'Switch to Renewable Energy',
      content: `Grid electricity (Scope 2) represents ${scope2Pct}% of emissions. At India's grid intensity of 0.82 kg CO2e/kWh, transitioning 30% of consumption to renewables could reduce total emissions by approximately ${(calc.scope2Kg * 0.3 / 1000).toFixed(2)} metric tons.`,
      metric: `${(calc.scope2Kg * 0.3 / 1000).toFixed(2)} t reduction possible`
    });
  }

  // ML correction insight
  const corrDeltaNum = parseFloat(correctionDelta);
  if (Math.abs(corrDeltaNum) > 0.1) {
    insights.push({
      type: corrDeltaNum > 0 ? 'alert' : 'success',
      title: corrDeltaNum > 0 ? 'ML Model Found Emission Uplift' : 'ML Correction Applied Savings',
      content: corrDeltaNum > 0
        ? `The XGBoost correction model detected a +${correctionDelta}t upward adjustment from your baseline. This likely reflects equipment aging or seasonal grid load effects. Review equipment maintenance schedules.`
        : `Our ML model applied a ${Math.abs(corrDeltaNum)}t downward correction from baseline, indicating optimized operating conditions. Maintain current equipment efficiency standards.`,
      metric: `${correctionDelta} t CO2e ML delta`
    });
  }

  // Trend insight
  if (trends.length >= 2) {
    const latest = trends[trends.length - 1];
    const prev = trends[trends.length - 2];
    const changePct = ((latest.totalKg - prev.totalKg) / prev.totalKg * 100).toFixed(1);
    const isIncrease = latest.totalKg > prev.totalKg;
    insights.push({
      type: isIncrease ? 'alert' : 'success',
      title: isIncrease ? 'Year-on-Year Emissions Increased' : 'Year-on-Year Emissions Reduced',
      content: isIncrease
        ? `Emissions grew by ${changePct}% from ${prev.period} to ${latest.period} (${(prev.totalKg/1000).toFixed(2)}t → ${(latest.totalKg/1000).toFixed(2)}t). Identify operational changes that drove this increase and set measurable reduction targets.`
        : `Emissions decreased by ${Math.abs(parseFloat(changePct))}% from ${prev.period} to ${latest.period}. This positive trend indicates effective carbon management. Consider setting a net-zero pathway target.`,
      metric: `${isIncrease ? '+' : ''}${changePct}% YoY change`
    });
  } else {
    insights.push({
      type: 'tip',
      title: 'Build Trend History',
      content: `Only ${trends.length} period${trends.length !== 1 ? 's' : ''} of data available. Add more reporting periods to enable year-over-year trend analysis, which is critical for BRSR/CSRD compliance reporting.`,
      metric: `${trends.length} period${trends.length !== 1 ? 's' : ''} recorded`
    });
  }

  // Total footprint context
  if (insights.length < 4) {
    insights.push({
      type: parseFloat(totalMt) > 1000 ? 'warning' : 'info',
      title: 'Total Carbon Footprint Summary',
      content: `Your total emissions of ${totalMt} metric tons CO2e ${parseFloat(totalMt) > 1000 ? 'exceeds 1,000t, requiring mandatory BRSR disclosure in India.' : 'is within a manageable range. Proactive BRSR compliance reporting is recommended.'} Focus on setting science-based targets aligned with the Paris Agreement's 1.5°C pathway.`,
      metric: `${totalMt} t CO2e total`
    });
  }

  return insights.slice(0, 4);
}
