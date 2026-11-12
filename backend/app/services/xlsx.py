"""Excel export of the deployment records."""
import io, re, zipfile
from xml.sax.saxutils import escape

# Excel (.xlsx) download of the records, with the same search and filters as the page. Built with zipfile (no extra
# package); every cell is an inline string, so nothing in a record can run as an Excel formula.
XLSX_COLS = [("Ticket ID", "rid", 14), ("Ticket Title", "title", 30), ("Application", "app_name", 24), ("Application URL", "app_url", 36),
             ("Server Name", "server_name", 20), ("Server IP / Host", "server_ip", 18), ("Deployment Type", "deployment_type", 16),
             ("Server Type", "server_type", 14), ("Environment", "environment", 14), ("Status", "status", 22), ("Version", "version", 12), ("Deployed At", "deployed_at", 22),
             ("Deployed By", "deployed_by_name", 22), ("Deployed By Email", "deployed_by_email", 30), ("Role", "deployed_by_role", 16),
             ("Pipeline Name", "pipeline_name", 20), ("Pipeline Run ID", "pipeline_run_id", 18), ("Commit ID", "commit_id", 14),
             ("Deployment Method", "method", 18), ("CI/CD Tool", "cicd_tool", 16), ("Repository", "repo_url", 36),
             ("Notes", "notes", 50), ("Submitted At", "submitted_at", 22)]
BAD_XML = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
def _col(i):
    n = ""
    while i: i, r = divmod(i - 1, 26); n = chr(65 + r) + n
    return n
def xlsx(sheet, cols, rows):
    def cell(ref, v, style=0):
        v = escape(BAD_XML.sub("", str(v if v is not None else "")))[:32000]
        st = ' s="%d"' % style if style else ""
        return '<c r="%s" t="inlineStr"%s><is><t xml:space="preserve">%s</t></is></c>' % (ref, st, v)
    data = ['<row r="1">%s</row>' % "".join(cell("%s1" % _col(j), h, 1) for j, (h, _, _) in enumerate(cols, 1))]
    data += ['<row r="%d">%s</row>' % (i, "".join(cell("%s%d" % (_col(j), i), r.get(k)) for j, (_, k, _) in enumerate(cols, 1))) for i, r in enumerate(rows, 2)]
    last = f"{_col(len(cols))}{len(rows) + 1}"
    ws = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
          '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
          + "<cols>" + "".join('<col min="%d" max="%d" width="%d" customWidth="1"/>' % (j, j, w) for j, (_, _, w) in enumerate(cols, 1)) + "</cols>"
          + '<sheetData>%s</sheetData><autoFilter ref="A1:%s"/></worksheet>' % ("".join(data), last))
    files = {
        "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
        "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f'<sheets><sheet name="{escape(sheet)}" sheetId="1" r:id="rId1"/></sheets>'
            f'<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'{escape(sheet)}\'!$A$1:${_col(len(cols))}${len(rows) + 1}</definedName></definedNames></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        "xl/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
            '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
            '<fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill></fills>'
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>',
        "xl/worksheets/sheet1.xml": ws}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, body in files.items(): z.writestr(name, body)
    return buf.getvalue()
