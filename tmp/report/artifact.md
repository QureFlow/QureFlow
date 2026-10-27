# QureFlow report template contract
Reference: C:\Users\ASUS\Downloads\BCSE302P_Mini_Project_Report_Template.docx
SHA256: 41cb3b2dce9e598fcd1628c9e6868e762167549cacedfdde0297e5a0309a045e
Reference render: reference-render, all 17 pages inspected.
Package evidence: template-package-inventory.json; template-style-evidence.json.
## Page and typography
One A4 portrait section, 11906 by 16838 twips, all four margins1440twips.
Different first page enabled: cover has no visible page number. Regular footer centred PAGE field.
Keep source cover institutional blocks, two-member table, faculty block and date.
Body Times New Roman12, line spacing1.5. Headings14boldblack per supplied guidelines.
Template duplicate heading styles and missing explicit Normal are normalized to these roles.
Source guidance italics/grey/blue are editable placeholders and removed.
Title black14bold, style Title; no new decorative rule.
Chapter headings use Heading1; subsection Heading2; dictionary table titles level3.
Tables retain source pale blue header fillD9E2F3, black text and thin black borders.
Repeat table headings, prevent row splits; body12 and line1.5.
Code is Times New Roman12 with the source light-grey block background; soft wraps allowed.
Captions12italicblack, directly below figures. Figures fit within6.26in text width.
## Slots and flow
word/document.xml body paragraphs0..20 and first table: update title, members, submission date.
Delete unused member rows3,4 and guidance paragraph13.
From CERTIFICATE onward replace all guidance blocks using cloned section/title/table patterns.
Preserve certificate faculty label and unsigned signature space; do not fabricate approval.
Sequence: certificate, abstract150to200words, real WordTOC, chapters1to10 from template.
Keep template subsections including Packages, explaining MySQL platform limitation.
Appendices hold the data dictionary, source map and terminal reproduction commands.
TOC/fields refreshed by installed Microsoft Word and PDF exported by Word.
## Evidence and factual boundaries
Use executed MySQL output and actual local browser screenshots; no invented native-phone screenshots.
Show a real browser booking and matching SQL before/after cancellation.
State that APK build/package verification passed but final hotspot device acceptance is pending.
Normalized core master relations are3NF; identify operational duplication rather than claim all BCNF.
## Package preservation
Authoring starts with a working copy of the retained DOCX.
Body/styles/settings/numbering/field caches/relationships and document metadata are editable.
Footer PAGE semantics, first-page behaviour, geometry and source institutional/faculty blocks are preserved.
Template has no embedded images, opaque customXML or controls containing authored content.
Empty annotation/footnote parts may be canonicalized by Word; no nonempty opaque content is removed.
New images and internal TOC bookmarks are authorized additions.
## Fidelity gates
Reference hash unchanged, oneA4 section,1in margins; all requested identities correct.
No guidance placeholders, code snippets must come from project SQL/repository source.
Check rendered PDF/PNG every page; compare chapter/table styles and cover with reference.
TOC page numbers verified against final PDF; unsigned certificate remains unsigned.

## Final verification
48 rendered pages inspected at original resolution. All 43 TOC references checked against the final PDF. Full schema source matches the project SQL. Reference template hash unchanged. New tables use 3-point cell padding for readability. Fonted visible PDF text uses Times New Roman at 12-point body and 14-point headings; Word uses Aptos only for nonprinting TOC tab whitespace. Final evidence and hashes are in qa-final.json.


19 October terminal evidence revision: replaced six SQL/test viewer images with native console captures and added Figure 6.2 for database/version/count SQL commands. Final PDF and DOCX contain 47 pages, 17 figures and 27 tables. All 43 TOC references verified. Thirteen changed page images inspected; 34 other page bodies match previously inspected pages pixel for pixel. Fresh integration execution passed 24 individual cases plus parent (25 pass, zero failures). No backend changes or remote publication.
