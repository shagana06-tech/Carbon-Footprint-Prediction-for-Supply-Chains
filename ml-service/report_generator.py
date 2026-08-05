import os
import tempfile
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for headless environments
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from typing import Dict, Any, List

def generate_pdf_report(payload: Dict[str, Any]) -> str:
    """
    Generates a ReportLab PDF and returns the file path to the generated document.
    """
    period = payload.get("period", "Unknown Period")
    format_type = payload.get("format", "BRSR")
    calc = payload.get("calculation", {})
    explainability = payload.get("explainability", [])
    trends = payload.get("trends", [])
    
    scope1_kg = calc.get("scope1Kg", 0.0)
    scope2_kg = calc.get("scope2Kg", 0.0)
    scope3_kg = calc.get("scope3Kg", 0.0)
    total_kg = calc.get("totalKg", 0.0)
    breakdown = calc.get("breakdown", [])
    
    # 1. Create Matplotlib Charts
    temp_files = []
    
    # Chart 1: Breakdown Pie Chart
    plt.figure(figsize=(5, 3.5))
    if len(breakdown) > 0 and sum(item.get("kg", 0.0) for item in breakdown) > 0:
        labels = [item["activityType"] for item in breakdown]
        sizes = [item["kg"] for item in breakdown]
        colors_list = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']
        plt.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=140, colors=colors_list[:len(sizes)], 
                textprops={'fontsize': 8, 'color': '#1E293B'})
    else:
        plt.text(0.5, 0.5, 'No Data Available', horizontalalignment='center', verticalalignment='center')
    plt.title("Carbon Emissions Breakdown (kg CO2e)", fontsize=10, fontweight='bold', color='#0F172A')
    plt.tight_layout()
    
    pie_fd, pie_path = tempfile.mkstemp(suffix=".png")
    os.close(pie_fd)
    plt.savefig(pie_path, dpi=200, transparent=True)
    plt.close()
    temp_files.append(pie_path)
    
    # Chart 2: Historical Trend Line
    plt.figure(figsize=(5, 3.5))
    if len(trends) > 0:
        periods = [t["period"] for t in trends]
        totals_t = [t["totalKg"] / 1000.0 for t in trends] # Convert to metric tons for display
        plt.plot(periods, totals_t, marker='o', linewidth=2, color='#10B981')
        plt.xlabel("Reporting Period", fontsize=8)
        plt.ylabel("Emissions (Metric Tons CO2e)", fontsize=8)
        plt.xticks(rotation=30, fontsize=7)
        plt.yticks(fontsize=7)
        plt.grid(True, linestyle='--', alpha=0.5)
    else:
        plt.text(0.5, 0.5, 'No Historical Data Available', horizontalalignment='center', verticalalignment='center')
    plt.title("Emissions Multi-Year Trend (t CO2e)", fontsize=10, fontweight='bold', color='#0F172A')
    plt.tight_layout()
    
    trend_fd, trend_path = tempfile.mkstemp(suffix=".png")
    os.close(trend_fd)
    plt.savefig(trend_path, dpi=200, transparent=True)
    plt.close()
    temp_files.append(trend_path)
    
    # 2. Build ReportLab Flowables
    pdf_fd, pdf_path = tempfile.mkstemp(suffix=".pdf")
    os.close(pdf_fd)
    
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=15
    )
    
    h1_style = ParagraphStyle(
        'DocH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=15,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#334155')
    )
    
    disclaimer_style = ParagraphStyle(
        'DocDisclaimer',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#DC2626'),
        spaceBefore=10,
        spaceAfter=10
    )
    
    story = []
    
    # Title & Header
    story.append(Paragraph(f"Carbon Footprint Predictive Report", title_style))
    story.append(Paragraph(f"Reporting Scope: {format_type} Framework Alignment  |  Reporting Period: {period}", body_style))
    story.append(Spacer(1, 10))
    
    # Disclaimer Callout Box
    disclaimer_text = "<b>IMPORTANT NOTE:</b> This document is a draft summary modeled on BRSR/CSRD sustainability disclosure structures. It is compiled for simulation and analysis purposes and is <b>NOT a certified regulatory filing</b>."
    disclaimer_table = Table([[Paragraph(disclaimer_text, disclaimer_style)]], colWidths=[530])
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FEF2F2')),
        ('BORDER', (0,0), (-1,-1), 1.5, colors.HexColor('#FCA5A5')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(disclaimer_table)
    story.append(Spacer(1, 15))
    
    # Summary Section
    story.append(Paragraph("1. Carbon Emissions Inventory Summary", h1_style))
    summary_intro = f"Operational data calculations for period <b>{period}</b> yield total emissions of <b>{total_kg/1000.0:.3f} metric tons of CO2e</b>. The Scope breakdown is detailed below:"
    story.append(Paragraph(summary_intro, body_style))
    story.append(Spacer(1, 8))
    
    # Scope Table
    table_data = [
        [Paragraph("<b>Scope Layer</b>", body_style), Paragraph("<b>Description</b>", body_style), Paragraph("<b>Emissions (kg CO2e)</b>", body_style), Paragraph("<b>Emissions (t CO2e)</b>", body_style)],
        [Paragraph("Scope 1 (Direct)", body_style), Paragraph("Direct emissions from owned or controlled sources (e.g. diesel fuels)", body_style), f"{scope1_kg:,.1f}", f"{scope1_kg/1000.0:,.3f}"],
        [Paragraph("Scope 2 (Energy)", body_style), Paragraph("Indirect emissions from purchased electricity", body_style), f"{scope2_kg:,.1f}", f"{scope2_kg/1000.0:,.3f}"],
        [Paragraph("Scope 3 (Supply Chain)", body_style), Paragraph("Indirect emissions in the company's value chain (freight, cotton raw materials)", body_style), f"{scope3_kg:,.1f}", f"{scope3_kg/1000.0:,.3f}"],
        [Paragraph("<b>Total Emissions Profile</b>", body_style), Paragraph("<b>Aggregate baseline + model corrected emissions</b>", body_style), f"<b>{total_kg:,.1f}</b>", f"<b>{total_kg/1000.0:,.3f}</b>"]
    ]
    summary_table = Table(table_data, colWidths=[120, 210, 100, 100])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor('#F8FAFC')]),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 15))
    
    # Graphics Section (Pie & Trend side by side)
    img_pie = Image(pie_path, width=250, height=175)
    img_trend = Image(trend_path, width=250, height=175)
    
    charts_table = Table([[img_pie, img_trend]], colWidths=[265, 265])
    charts_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(charts_table)
    story.append(Spacer(1, 10))
    
    story.append(PageBreak()) # Push Explainability & Recommendations to Page 2
    
    # Explainability Section
    story.append(Paragraph("2. Explainable AI (SHAP) Model Corrections", h1_style))
    explain_intro = "Our system applies a machine learning model (XGBoost) trained on historical corporate records to correct static coefficient-based baselines. The model evaluates features such as equipment age, seasons, and region. Here are the top drivers of emissions corrections for this period ranked by SHAP contribution:"
    story.append(Paragraph(explain_intro, body_style))
    story.append(Spacer(1, 8))
    
    explain_story = []
    if len(explainability) > 0:
        for idx, item in enumerate(explainability):
            explain_text = f"<b>{idx+1}. {item.get('feature')}:</b> {item.get('plainLanguage')}"
            explain_story.append([Paragraph(explain_text, body_style)])
    else:
        explain_story.append([Paragraph("No model explainability factors computed for this period. Seeding baseline models to activate ML corrections.", body_style)])
        
    explain_table = Table(explain_story, colWidths=[530])
    explain_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BORDER', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(explain_table)
    story.append(Spacer(1, 15))
    
    # Recommendations Section
    story.append(Paragraph("3. Recommendations & Reduction Strategies", h1_style))
    rec_intro = "The following recommendations are dynamically generated based on your company's operational emission breakdown and what-if simulation savings calculations:"
    story.append(Paragraph(rec_intro, body_style))
    story.append(Spacer(1, 8))
    
    # Generate top recommendations based on breakdown
    # Sort activities by emissions size
    sorted_activities = sorted(breakdown, key=lambda x: x["kg"], reverse=True)
    recs = []
    
    for activity in sorted_activities:
        act_type = activity["activityType"]
        act_kg = activity["kg"]
        
        if act_type == "electricity" and act_kg > 0:
            recs.append("<b>Renewable Energy Sourcing:</b> Transitioning 50% of your electricity load in India to renewable power (solar/wind grid allocations) can reduce Scope 2 grid emissions by up to <b>{:.1f} kg CO2e</b>.".format(act_kg * 0.5))
        elif act_type == "roadTransport" and act_kg > 0:
            recs.append("<b>Intermodal Freight Logistics:</b> Shifting 30% of your road transport volume to rail transport is projected to reduce Scope 3 transport emissions by <b>{:.1f} kg CO2e</b>.".format(act_kg * 0.3))
        elif act_type == "rawMaterial" and act_kg > 0:
            recs.append("<b>Eco-designed Supply Partnerships:</b> Substituting 20% of your standard cotton raw materials with organic low-impact suppliers is estimated to save <b>{:.1f} kg CO2e</b> in Scope 3 sourcing.".format(act_kg * 0.2))
            
    # Add general fallback
    recs.append("<b>Equipment Efficiency Auditing:</b> Undertake structural auditing of diesel-burning generators and freight equipment. Upgrading older infrastructure can yield 10% to 15% efficiency gains in Scope 1 direct outputs.")
    
    rec_story = []
    for idx, rec in enumerate(recs[:3]): # top 3 recommendations
        rec_story.append([Paragraph(f"• {rec}", body_style)])
        
    rec_table = Table(rec_story, colWidths=[530])
    rec_table.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(rec_table)
    story.append(Spacer(1, 20))
    
    # Signoff footer block
    signoff_text = "<i>Report generated on behalf of the Carbon Footprint Simulation Platform. Verification ID: CF-{}-DEMO.</i>".format(period)
    story.append(Paragraph(signoff_text, body_style))
    
    # 3. Build document
    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(colors.HexColor('#DC2626'))
        canvas.drawString(40, 20, "DRAFT SUMMARY — NOT A CERTIFIED REGULATORY FILING")
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.HexColor('#64748B'))
        canvas.drawRightString(letter[0]-40, 20, f"Page {doc.page}")
        canvas.restoreState()
        
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    
    # Clean up temp files except the generated PDF
    # The caller must delete the PDF file when finished streaming it!
    for f in temp_files:
        try:
            os.remove(f)
        except Exception:
            pass
            
    return pdf_path
