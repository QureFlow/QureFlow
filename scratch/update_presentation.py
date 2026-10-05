import os
import pptx
from pptx.util import Pt, Inches, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from PIL import Image, ImageDraw, ImageFont

def generate_formula_image():
    # Render high-resolution crisp formula image
    font_main = ImageFont.truetype('C:/Windows/Fonts/georgia.ttf', 44)
    font_sub = ImageFont.truetype('C:/Windows/Fonts/georgia.ttf', 28)
    font_italic = ImageFont.truetype('C:/Windows/Fonts/georgiai.ttf', 44)

    color = (0, 80, 136, 255) # Deep navy matching slide palette

    segments = [
        ('EWT = ', font_main, 0),
        ('t', font_italic, 0),
        ('active', font_sub, 14),
        (' \u00d7 ', font_main, 0),
        ('p', font_italic, 0),
        ('active', font_sub, 14),
        (' + (', font_main, 0),
        ('p', font_italic, 0),
        (' - 1) \u00d7 ', font_main, 0),
        ('t', font_italic, 0),
        ('avg', font_sub, 14),
        (' + ', font_main, 0),
        ('buffer', font_italic, 0),
    ]

    img_temp = Image.new('RGBA', (2000, 200), (0, 0, 0, 0))
    draw_temp = ImageDraw.Draw(img_temp)

    total_w = 0
    for text, font, y_off in segments:
        bbox = draw_temp.textbbox((0, 0), text, font=font)
        total_w += (bbox[2] - bbox[0])

    img = Image.new('RGBA', (total_w + 50, 95), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    curr_x = 25
    base_y = 22
    for text, font, y_off in segments:
        draw.text((curr_x, base_y + y_off), text, font=font, fill=color)
        bbox = draw.textbbox((0, 0), text, font=font)
        curr_x += (bbox[2] - bbox[0])

    os.makedirs('scratch', exist_ok=True)
    out_path = 'scratch/qureflow_formula.png'
    img.save(out_path)
    print(f'Rendered formula image: {out_path} ({img.size[0]}x{img.size[1]})')
    return out_path, img.size[0], img.size[1]


def update_presentation():
    formula_path, fw, fh = generate_formula_image()
    with open(formula_path, 'rb') as f:
        new_formula_bytes = f.read()

    prs = pptx.Presentation('Qureflow - Smart Queue Management Presentation.pptx')

    # 1. Slide 1 (Title)
    s1 = prs.slides[0]
    for shape in s1.shapes:
        if shape.has_text_frame and shape.text_frame.text.strip() == 'Qureflow':
            shape.text_frame.paragraphs[0].runs[0].text = 'QureFlow'
            print('Updated Slide 1 Title to QureFlow')

    # 2. Slide 3 (Intro)
    s3 = prs.slides[2]
    for shape in s3.shapes:
        if shape.has_text_frame and 'QueueLess' in shape.text_frame.text:
            shape.text_frame.paragraphs[0].runs[0].text = 'Introducing QureFlow'
            print('Updated Slide 3 Title: Removed QueueLess')

    # 3. Slide 4 (Vision)
    s4 = prs.slides[3]
    for shape in s4.shapes:
        if shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                if 'Vision' in p.text:
                    p.text = 'The QureFlow Vision'
                    if p.runs:
                        p.runs[0].font.name = 'Merriweather'
                        p.runs[0].font.size = Pt(21)
                        p.runs[0].font.bold = True
                    print('Updated Slide 4 Vision heading (cleaned encoding)')

    # 4. Slide 9 (Algorithm & Wait Times)
    s9 = prs.slides[8]
    # Update TextBox 4 (Shape 3)
    tb4 = s9.shapes[3]
    tb4.text_frame.text = 'Dynamic Waiting Time Formula'
    if tb4.text_frame.paragraphs[0].runs:
        tb4.text_frame.paragraphs[0].runs[0].font.name = 'Merriweather'
        tb4.text_frame.paragraphs[0].runs[0].font.size = Pt(21)
        tb4.text_frame.paragraphs[0].runs[0].font.bold = True

    # Update TextBox 5 (Shape 4)
    tb5 = s9.shapes[4]
    tb5.text_frame.text = 'QureFlow calculates live Estimated Wait Time (EWT) per patient using the dynamic throughput formula:'
    if tb5.text_frame.paragraphs[0].runs:
        tb5.text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
        tb5.text_frame.paragraphs[0].runs[0].font.size = Pt(13)

    # Update Picture 8 (Shape 7) - replace image blob with new formula
    pic7 = s9.shapes[7]
    blip = pic7._element.xpath('.//a:blip')[0]
    rId = blip.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed']
    part = s9.part.related_part(rId)
    part._blob = new_formula_bytes

    # Center new formula nicely within the card container (Shape 1)
    card = s9.shapes[1]
    card_cx = card.left + card.width // 2
    card_cy = card.top + card.height // 2
    # Scale formula image to fit inside card
    target_w = int(card.width * 0.88)
    target_h = int(target_w * (fh / fw))
    pic7.width = target_w
    pic7.height = target_h
    pic7.left = card_cx - target_w // 2
    pic7.top = card_cy - target_h // 2
    print('Updated Slide 9 formula image and centering')

    # Update TextBox 6 (Shape 5) - Bullet points explaining variables and slot capacity guard
    tb6 = s9.shapes[5]
    tb6.top = card.top + card.height + Emu(150000)
    tb6.height = Emu(2100000)
    tb6.text_frame.clear()

    bullet_data = [
        ('- t_active * p_active: ', True, 'Remaining active consultation time (if doctor is serving, p_active=1; else 0).', False),
        ('- (p - 1) * t_avg: ', True, 'Waiting load ahead (p patients ahead) multiplied by average consultation duration (10 min).', False),
        ('- buffer: ', True, 'Transit and sanitization overhead added per patient visit (2 min).', False),
        ('- Dynamic Slot Saturation: ', True, 'Live booking shows exact queue depth ("2 ahead, ~14m"). If EWT >= slot duration (30 min), the slot dynamically marks "Slot Full" to prevent clinic congestion.', False),
    ]

    for i, (b_title, b_bold, b_desc, d_bold) in enumerate(bullet_data):
        p = tb6.text_frame.add_paragraph() if i > 0 else tb6.text_frame.paragraphs[0]
        p.space_after = Pt(4)
        run1 = p.add_run()
        run1.text = b_title
        run1.font.name = 'DM Sans'
        run1.font.size = Pt(11)
        run1.font.bold = b_bold

        run2 = p.add_run()
        run2.text = b_desc
        run2.font.name = 'DM Sans'
        run2.font.size = Pt(11)
        run2.font.bold = d_bold

    print('Updated Slide 9 descriptions & parameters')

    # 5. Slide 12 (AWS Service Integrations)
    s12 = prs.slides[11]
    # Shape 4 & 5
    s12.shapes[4].text_frame.paragraphs[0].text = 'AWS Compute & API'
    s12.shapes[4].text_frame.paragraphs[0].runs[0].font.name = 'Merriweather'
    s12.shapes[4].text_frame.paragraphs[0].runs[0].font.size = Pt(21)
    s12.shapes[4].text_frame.paragraphs[0].runs[0].font.bold = True

    s12.shapes[5].text_frame.paragraphs[0].text = 'High-throughput Node.js microservices executing dynamic wait time algorithms, slot capacity guards, and concurrency locks.'
    s12.shapes[5].text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
    s12.shapes[5].text_frame.paragraphs[0].runs[0].font.size = Pt(13)

    # Shape 6 & 7
    s12.shapes[6].text_frame.paragraphs[0].text = 'AWS DynamoDB'
    s12.shapes[6].text_frame.paragraphs[0].runs[0].font.name = 'Merriweather'
    s12.shapes[6].text_frame.paragraphs[0].runs[0].font.size = Pt(21)
    s12.shapes[6].text_frame.paragraphs[0].runs[0].font.bold = True

    s12.shapes[7].text_frame.paragraphs[0].text = 'Single-Table NoSQL architecture (QureFlow-Main) with atomic counters and GSIs delivering sub-10ms queries for live queue tracking.'
    s12.shapes[7].text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
    s12.shapes[7].text_frame.paragraphs[0].runs[0].font.size = Pt(13)

    # Shape 8 & 9
    s12.shapes[8].text_frame.paragraphs[0].text = 'Cognito & Cellular SMS'
    s12.shapes[8].text_frame.paragraphs[0].runs[0].font.name = 'Merriweather'
    s12.shapes[8].text_frame.paragraphs[0].runs[0].font.size = Pt(21)
    s12.shapes[8].text_frame.paragraphs[0].runs[0].font.bold = True

    s12.shapes[9].text_frame.paragraphs[0].text = 'Enterprise identity with JWT Role-Based Access Control (RBAC), paired with Fast2SMS cellular dispatch for offline rural patients.'
    s12.shapes[9].text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
    s12.shapes[9].text_frame.paragraphs[0].runs[0].font.size = Pt(13)
    print('Updated Slide 12 AWS Integrations')

    # 6. Slide 13 (Core Technologies Table)
    s13 = prs.slides[12]
    table = s13.shapes[2].table
    row_contents = [
        ('Frontend & UI', 'React 18 & Tailwind CSS', 'Responsive mobile-first client, dynamic slot capacity pickers, and real-time wait displays.'),
        ('Backend API', 'Node.js & Express (TypeScript)', 'High-concurrency RESTful engine for EWT calculations, slot locks, and triage routing.'),
        ('Database & Storage', 'AWS DynamoDB (Single-Table)', 'Unified schema (PK/SK), GSI1/2/3 indexing, and atomic FIFO token counter serialization.'),
        ('Auth & Cellular SMS', 'AWS Cognito & Fast2SMS', 'Enterprise JWT role-based access control paired with cellular SMS alerts for rural patients.')
    ]
    for r_idx, (domain, tech, purpose) in enumerate(row_contents, start=1):
        cell0 = table.rows[r_idx].cells[0]
        cell0.text = domain
        cell0.text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
        cell0.text_frame.paragraphs[0].runs[0].font.size = Pt(13)
        cell0.text_frame.paragraphs[0].runs[0].font.bold = True

        cell1 = table.rows[r_idx].cells[1]
        cell1.text = tech
        cell1.text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
        cell1.text_frame.paragraphs[0].runs[0].font.size = Pt(13)
        cell1.text_frame.paragraphs[0].runs[0].font.bold = False

        cell2 = table.rows[r_idx].cells[2]
        cell2.text = purpose
        cell2.text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
        cell2.text_frame.paragraphs[0].runs[0].font.size = Pt(13)
        cell2.text_frame.paragraphs[0].runs[0].font.bold = False
    print('Updated Slide 13 Core Technologies Table')

    # 7. Slide 14 (Security & Authentication)
    s14 = prs.slides[13]
    s14.shapes[3].text_frame.paragraphs[0].text = 'AWS Cognito & JWT Authentication'
    s14.shapes[3].text_frame.paragraphs[0].runs[0].font.name = 'Merriweather'
    s14.shapes[3].text_frame.paragraphs[0].runs[0].font.size = Pt(21)
    s14.shapes[3].text_frame.paragraphs[0].runs[0].font.bold = True

    s14.shapes[4].text_frame.paragraphs[0].text = 'QureFlow integrates authService with AWS Cognito and secure JWT token validation. Patient records, phone numbers, and consultation histories are encrypted in-transit (TLS 1.3) and at-rest.'
    s14.shapes[4].text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
    s14.shapes[4].text_frame.paragraphs[0].runs[0].font.size = Pt(13)

    s14.shapes[5].text_frame.paragraphs[0].text = 'Role-Based Access Control (RBAC)'
    s14.shapes[5].text_frame.paragraphs[0].runs[0].font.name = 'Merriweather'
    s14.shapes[5].text_frame.paragraphs[0].runs[0].font.size = Pt(21)
    s14.shapes[5].text_frame.paragraphs[0].runs[0].font.bold = True

    s14.shapes[6].text_frame.paragraphs[0].text = 'Strict API route guards enforce granular permissions across Patients, Doctors, and Clinic Health Workers. DynamoDB conditional writes prevent double-booking and unauthorized queue modifications.'
    s14.shapes[6].text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
    s14.shapes[6].text_frame.paragraphs[0].runs[0].font.size = Pt(13)
    print('Updated Slide 14 Security & Authentication')

    # 8. Slide 15 (Scalable Data Management)
    s15 = prs.slides[14]
    s15.shapes[2].text_frame.paragraphs[0].text = 'DynamoDB Single-Table Architecture'
    s15.shapes[2].text_frame.paragraphs[0].runs[0].font.name = 'Merriweather'
    s15.shapes[2].text_frame.paragraphs[0].runs[0].font.size = Pt(21)
    s15.shapes[2].text_frame.paragraphs[0].runs[0].font.bold = True

    s15.shapes[3].text_frame.paragraphs[0].text = 'The platform implements a unified Single-Table pattern (QureFlow-Main) via dynamoDbRepo.ts. Global Secondary Indexes (GSI1 for clinic schedules, GSI2 for active queues, GSI3 for emergency triage) eliminate slow table scans.'
    s15.shapes[3].text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
    s15.shapes[3].text_frame.paragraphs[0].runs[0].font.size = Pt(13)

    s15.shapes[4].text_frame.paragraphs[0].text = 'Atomic counters (ADD currentNumber 1) guarantee race-condition-free token generation under heavy concurrent booking loads, delivering sub-10ms latency with zero deadlocks.'
    s15.shapes[4].text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
    s15.shapes[4].text_frame.paragraphs[0].runs[0].font.size = Pt(13)
    print('Updated Slide 15 Scalable Data Management')

    # 9. Slide 16 (The Patient Journey)
    s16 = prs.slides[15]
    steps_16 = [
        (2, 3, 'Mobile Auth', 'Patient registers or logs in via phone number OTP, verified through AWS Cognito / JWT.'),
        (4, 5, 'Smart Booking', 'Selects clinic slot showing live load ("X ahead, ~Ym") with automated "Slot Full" guard.'),
        (6, 7, 'Live Tracking', 'Monitors real-time EWT countdown, token position, and receives cellular SMS reminders.'),
        (8, 9, 'Prompt Consult', 'Arrives just-in-time when called, completely bypassing crowded waiting rooms.')
    ]
    for h_idx, b_idx, head, body in steps_16:
        sh_h = s16.shapes[h_idx]
        sh_h.text_frame.paragraphs[0].text = head
        sh_h.text_frame.paragraphs[0].runs[0].font.name = 'Merriweather'
        sh_h.text_frame.paragraphs[0].runs[0].font.size = Pt(20)
        sh_h.text_frame.paragraphs[0].runs[0].font.bold = True

        sh_b = s16.shapes[b_idx]
        sh_b.text_frame.paragraphs[0].text = body
        sh_b.text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
        sh_b.text_frame.paragraphs[0].runs[0].font.size = Pt(13)
    print('Updated Slide 16 Patient Journey')

    # 10. Slide 17 (The Doctor & Worker Journey)
    s17 = prs.slides[16]
    steps_17 = [
        (2, 3, 'Shift Activation', 'Doctor / Health worker launches daily clinic console and activates live queue reception.'),
        (4, 5, 'Load & Triage', 'Monitors patient load and flags emergencies for instant top-of-queue bypass via GSI3.'),
        (6, 7, 'Active Console', 'Conducts consultation with live elapsed timer, patient vitals, and diagnostic notes.'),
        (8, 9, 'Token Chime & Next', 'Marks visit complete; system triggers automated chime sound and summons the next token.')
    ]
    for h_idx, b_idx, head, body in steps_17:
        sh_h = s17.shapes[h_idx]
        sh_h.text_frame.paragraphs[0].text = head
        sh_h.text_frame.paragraphs[0].runs[0].font.name = 'Merriweather'
        sh_h.text_frame.paragraphs[0].runs[0].font.size = Pt(20)
        sh_h.text_frame.paragraphs[0].runs[0].font.bold = True

        sh_b = s17.shapes[b_idx]
        sh_b.text_frame.paragraphs[0].text = body
        sh_b.text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
        sh_b.text_frame.paragraphs[0].runs[0].font.size = Pt(13)
    print('Updated Slide 17 Doctor & Worker Journey')

    # 11. Slide 25 (Conclusion)
    s25 = prs.slides[24]
    s25.shapes[1].text_frame.paragraphs[0].text = 'Thank you for exploring QureFlow.'
    s25.shapes[1].text_frame.paragraphs[0].runs[0].font.name = 'DM Sans'
    s25.shapes[1].text_frame.paragraphs[0].runs[0].font.size = Pt(15)
    print('Updated Slide 25 Conclusion')

    prs.save('Qureflow - Smart Queue Management Presentation.pptx')
    print('Successfully saved updated presentation to Qureflow - Smart Queue Management Presentation.pptx!')

if __name__ == '__main__':
    update_presentation()
