import Foundation

/// Opmaak van een cel; de volgorde komt overeen met `cellXfs` in de stijlen.
enum XLStyle: Int, CaseIterable {
    case normal, title, label, value, weekDate, legend, note, text, hours, code, totalLabel, totalValue, weekRow, weekTotal,
         weekTotalLabel

    /// Lettertype: 0 normaal, 1 vet, 2 titel, 3 klein, 4 klein cursief.
    var fontId: Int {
        switch self {
        case .title: 2
        case .legend: 3
        case .note: 4
        case .code, .totalLabel, .weekRow, .weekTotal, .weekTotalLabel: 1
        default: 0
        }
    }

    /// Opvulling: 0 geen, 2 grijs.
    var fillId: Int {
        switch self {
        case .title, .label, .legend, .note, .totalLabel, .totalValue, .weekRow, .weekTotal, .weekTotalLabel: 2
        default: 0
        }
    }

    /// Rand: 0 geen, 1 dik rondom, 2 uren-cel, 3 code-cel, 4/5/6 begin, midden en einde van de weekregel
    /// (één grijs blok: geen lijnen tussen de delen).
    var borderId: Int {
        switch self {
        case .normal: 0
        case .hours: 2
        case .code: 3
        case .weekRow: 4
        case .weekTotalLabel: 5
        case .weekTotal: 6
        default: 1
        }
    }

    var numFmtId: Int {
        self == .hours || self == .totalValue || self == .weekTotal ? 164 : 0
    }

    // Voor het tekenen (PDF): lettergrootte in punten, vet, cursief, links uitgelijnd, tekstomloop.
    var fontSize: Double { [10, 10, 20, 9, 8][fontId] }
    var isBold: Bool { fontId == 1 }
    var isItalic: Bool { fontId == 4 }
    var isGray: Bool { fillId == 2 }
    var alignsLeft: Bool { self == .weekDate || self == .text || self == .weekRow }
    var alignsRight: Bool { self == .weekTotalLabel }
    var wraps: Bool { self == .note }
    /// Linker- en rechterrand (boven en onder zijn altijd dik, behalve bij `normal`).
    var leftLine: XLLine {
        switch borderId {
        case 0, 5, 6: .none
        case 3: .thin
        default: .thick
        }
    }
    var rightLine: XLLine {
        switch borderId {
        case 0, 4, 5: .none
        case 2: .thin
        default: .thick
        }
    }

    fileprivate var alignment: String {
        switch self {
        case .normal: ""
        case .weekDate, .text, .weekRow: #"<alignment horizontal="left" vertical="center" indent="1"/>"#
        case .weekTotalLabel: #"<alignment horizontal="right" vertical="center" indent="1"/>"#
        case .note: #"<alignment horizontal="center" vertical="center" wrapText="1"/>"#
        default: #"<alignment horizontal="center" vertical="center"/>"#
        }
    }
}

enum XLLine {
    case none, thin, thick
}

enum XLValue {
    case text(String)
    case number(Double)
    case formula(String, cached: Double)
    case blank
}

struct XLCell {
    var value: XLValue
    var style: XLStyle

    /// Tekst zoals Excel ze toont.
    var display: String {
        switch value {
        case .text(let text): text
        case .number(let v): style.numFmtId == 164 ? Self.hoursMinutes(v) : String(Int(v))
        case .formula(_, let cached): Self.hoursMinutes(cached)
        case .blank: ""
        }
    }

    /// Tijd als deel van een dag, getoond als uren:minuten ("9:45"), zoals Excel met [h]:mm.
    private static func hoursMinutes(_ days: Double) -> String {
        let minutes = Int((days * 24 * 60).rounded())
        return "\(minutes / 60):\(String(format: "%02d", minutes % 60))"
    }
}

struct XLFooter {
    var left = ""
    var center = ""
    var right = ""

    /// Zoals Excel het verwacht: &L, &C en &R voor links, midden en rechts.
    var excelCodes: String {
        (left.isEmpty ? "" : "&L" + left) + (center.isEmpty ? "" : "&C" + center) + (right.isEmpty ? "" : "&R" + right)
    }

    /// Gewone tekst in een Excel-voettekst (een & moet dubbel).
    static func literal(_ text: String) -> String { text.replacingOccurrences(of: "&", with: "&&") }
}

struct XLRange {
    var row: Int
    var column: Int
    var lastRow: Int
    var lastColumn: Int
}

struct XLRect {
    var x: Double
    var y: Double
    var width: Double
    var height: Double
}

/// Afbeelding vastgezet in de linkerbovenhoek van A1, met grootte in pixels.
/// Sommige programma's (zoals de voorbeeldweergave van Apple) negeren de positie van een
/// afbeelding en tekenen ze altijd linksboven. Daarom begint de afbeelding in A1 en staat de
/// inhoud (het logo) op `content`; de rest van de afbeelding is doorzichtig.
struct XLImage {
    var width: Double
    var height: Double
    var content: XLRect
}

struct XLSheet {
    var name: String
    /// Kolombreedtes in tekens, zoals in Excel.
    var columnWidths: [Double]
    /// Rijhoogtes in punten, per rijnummer (vanaf 1).
    var rowHeights: [Int: Double] = [:]
    private(set) var cells: [Int: [Int: XLCell]] = [:]
    private(set) var ranges: [XLRange] = []
    var merges: [String] { ranges.map { "\(Self.ref($0.row, $0.column)):\(Self.ref($0.lastRow, $0.lastColumn))" } }
    var image: XLImage?
    /// Afdrukken: rijen die bovenaan elke pagina herhaald worden.
    var printTitleRows: ClosedRange<Int>?
    /// Voettekst links, midden en rechts; in Excel met codes zoals &P (pagina) en &N (aantal pagina's).
    var footer: XLFooter?
    /// Andere voettekst voor de eerste afgedrukte pagina (Excel).
    var firstPageFooter: XLFooter?

    static let defaultRowHeight = 15.0

    init(name: String, columnWidths: [Double]) {
        self.name = name
        self.columnWidths = columnWidths
    }

    mutating func set(_ row: Int, _ column: Int, _ value: XLValue, _ style: XLStyle) {
        cells[row, default: [:]][column] = XLCell(value: value, style: style)
    }

    /// Voegt cellen samen; elke cel krijgt de opmaak, zodat de randen overal kloppen.
    mutating func merge(_ row: Int, _ column: Int, to lastRow: Int, _ lastColumn: Int, _ value: XLValue, _ style: XLStyle) {
        for r in row...lastRow {
            for c in column...lastColumn { set(r, c, .blank, style) }
        }
        set(row, column, value, style)
        if lastRow > row || lastColumn > column {
            ranges.append(XLRange(row: row, column: column, lastRow: lastRow, lastColumn: lastColumn))
        }
    }

    var lastRow: Int { max(cells.keys.max() ?? 1, rowHeights.keys.max() ?? 1) }

    func rowHeight(_ row: Int) -> Double { rowHeights[row] ?? Self.defaultRowHeight }

    /// Breedte in pixels zoals Excel die tekent (Arial 10).
    static func columnPixels(_ characters: Double) -> Double { (characters * 7 + 5).rounded(.down) }

    static func rowPixels(_ points: Double) -> Double { points * 4 / 3 }

    static func column(_ index: Int) -> String {
        var n = index + 1
        var name = ""
        while n > 0 {
            let r = (n - 1) % 26
            name = String(UnicodeScalar(65 + r)!) + name
            n = (n - 1) / 26
        }
        return name
    }

    static func ref(_ row: Int, _ column: Int) -> String { "\(Self.column(column))\(row)" }
}

/// Schrijft een .xlsx-bestand (Office Open XML) met samengevoegde cellen, randen en een logo.
struct Workbook {
    var sheets: [XLSheet]
    /// PNG die op elk blad met een `image` getoond wordt.
    var image: Data?

    func xlsx() -> Data {
        var zip = ZipWriter()
        zip.add(path: "[Content_Types].xml", contents: Data(contentTypes.utf8))
        zip.add(path: "_rels/.rels", contents: Data(rels([("officeDocument", "xl/workbook.xml")]).utf8))
        zip.add(path: "xl/workbook.xml", contents: Data(workbookXML.utf8))
        zip.add(path: "xl/_rels/workbook.xml.rels", contents: Data(rels(
            sheets.indices.map { ("worksheet", "worksheets/sheet\($0 + 1).xml") } + [("styles", "styles.xml")]
        ).utf8))
        zip.add(path: "xl/styles.xml", contents: Data(Self.styles.utf8))
        for (i, sheet) in sheets.enumerated() {
            let n = i + 1
            let drawing = hasDrawing(sheet)
            zip.add(path: "xl/worksheets/sheet\(n).xml", contents: Data(sheetXML(sheet, drawing: drawing).utf8))
            if drawing, let picture = sheet.image {
                zip.add(path: "xl/worksheets/_rels/sheet\(n).xml.rels",
                        contents: Data(rels([("drawing", "../drawings/drawing\(n).xml")]).utf8))
                zip.add(path: "xl/drawings/drawing\(n).xml", contents: Data(drawingXML(sheet, picture).utf8))
                zip.add(path: "xl/drawings/_rels/drawing\(n).xml.rels",
                        contents: Data(rels([("image", "../media/image1.png")]).utf8))
            }
        }
        if let image { zip.add(path: "xl/media/image1.png", contents: image) }
        return zip.finalize()
    }

    private func hasDrawing(_ sheet: XLSheet) -> Bool { image != nil && sheet.image != nil }

    // MARK: Onderdelen

    private var contentTypes: String {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">"#
        xml += #"<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>"#
        xml += #"<Default Extension="xml" ContentType="application/xml"/>"#
        xml += #"<Default Extension="png" ContentType="image/png"/>"#
        xml += #"<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>"#
        xml += #"<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>"#
        for (i, sheet) in sheets.enumerated() {
            xml += "<Override PartName=\"/xl/worksheets/sheet\(i + 1).xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>"
            if hasDrawing(sheet) {
                xml += "<Override PartName=\"/xl/drawings/drawing\(i + 1).xml\" ContentType=\"application/vnd.openxmlformats-officedocument.drawing+xml\"/>"
            }
        }
        return xml + "</Types>"
    }

    private func rels(_ items: [(type: String, target: String)]) -> String {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">"#
        for (i, item) in items.enumerated() {
            xml += "<Relationship Id=\"rId\(i + 1)\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/\(item.type)\" Target=\"\(item.target)\"/>"
        }
        return xml + "</Relationships>"
    }

    private var workbookXML: String {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>"#
        for (i, sheet) in sheets.enumerated() {
            xml += "<sheet name=\"\(escape(sheet.name))\" sheetId=\"\(i + 1)\" r:id=\"rId\(i + 1)\"/>"
        }
        xml += "</sheets>"
        let titles = sheets.enumerated().compactMap { i, sheet in
            sheet.printTitleRows.map { rows in
                let name = sheet.name.replacingOccurrences(of: "'", with: "''")
                return "<definedName name=\"_xlnm.Print_Titles\" localSheetId=\"\(i)\">\(escape("'\(name)'!$\(rows.lowerBound):$\(rows.upperBound)"))</definedName>"
            }
        }
        if !titles.isEmpty { xml += "<definedNames>\(titles.joined())</definedNames>" }
        return xml + "</workbook>"
    }

    private func sheetXML(_ sheet: XLSheet, drawing: Bool) -> String {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">"#
        xml += #"<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>"#
        xml += #"<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>"#
        xml += "<cols>"
        for (i, width) in sheet.columnWidths.enumerated() {
            xml += "<col min=\"\(i + 1)\" max=\"\(i + 1)\" width=\"\(width)\" customWidth=\"1\"/>"
        }
        xml += "</cols><sheetData>"
        for row in 1...sheet.lastRow {
            let height = sheet.rowHeights[row].map { " ht=\"\($0)\" customHeight=\"1\"" } ?? ""
            xml += "<row r=\"\(row)\"\(height)>"
            for (column, cell) in (sheet.cells[row] ?? [:]).sorted(by: { $0.key < $1.key }) {
                let ref = XLSheet.ref(row, column)
                let s = cell.style.rawValue
                switch cell.value {
                case .text(let text):
                    xml += "<c r=\"\(ref)\" t=\"inlineStr\" s=\"\(s)\"><is><t xml:space=\"preserve\">\(escape(text))</t></is></c>"
                case .number(let value):
                    xml += "<c r=\"\(ref)\" s=\"\(s)\"><v>\(value)</v></c>"
                case .formula(let formula, let cached):
                    xml += "<c r=\"\(ref)\" s=\"\(s)\"><f>\(escape(formula))</f><v>\(cached)</v></c>"
                case .blank:
                    xml += "<c r=\"\(ref)\" s=\"\(s)\"/>"
                }
            }
            xml += "</row>"
        }
        xml += "</sheetData>"
        if !sheet.merges.isEmpty {
            xml += "<mergeCells count=\"\(sheet.merges.count)\">"
            xml += sheet.merges.map { "<mergeCell ref=\"\($0)\"/>" }.joined()
            xml += "</mergeCells>"
        }
        xml += #"<pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>"#
        // Passend in de breedte; Excel verdeelt de lijnen zelf over zoveel pagina's als nodig.
        xml += #"<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>"#
        if let footer = sheet.footer {
            xml += "<headerFooter\(sheet.firstPageFooter == nil ? "" : " differentFirst=\"1\"")>"
            xml += "<oddFooter>\(escape(footer.excelCodes))</oddFooter>"
            if let first = sheet.firstPageFooter { xml += "<firstFooter>\(escape(first.excelCodes))</firstFooter>" }
            xml += "</headerFooter>"
        }
        if drawing { xml += #"<drawing r:id="rId1"/>"# }
        return xml + "</worksheet>"
    }

    /// Zet een positie in pixels om naar een cel plus verschuiving (in EMU) binnen die cel.
    private func anchor(_ sheet: XLSheet, x: Double, y: Double) -> (column: Int, columnOffset: Int, row: Int, rowOffset: Int) {
        var column = 0
        var left = x
        while column < sheet.columnWidths.count - 1, left >= XLSheet.columnPixels(sheet.columnWidths[column]) {
            left -= XLSheet.columnPixels(sheet.columnWidths[column])
            column += 1
        }
        var row = 1
        var top = y
        while top >= XLSheet.rowPixels(sheet.rowHeight(row)) {
            top -= XLSheet.rowPixels(sheet.rowHeight(row))
            row += 1
        }
        return (column, Int(left * 9525), row - 1, Int(top * 9525))
    }

    private func drawingXML(_ sheet: XLSheet, _ picture: XLImage) -> String {
        let a = anchor(sheet, x: 0, y: 0)
        let b = anchor(sheet, x: picture.width, y: picture.height)
        let cx = Int(picture.width * 9525)
        let cy = Int(picture.height * 9525)
        return """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\
        <xdr:twoCellAnchor editAs="oneCell">\
        <xdr:from><xdr:col>\(a.column)</xdr:col><xdr:colOff>\(a.columnOffset)</xdr:colOff><xdr:row>\(a.row)</xdr:row><xdr:rowOff>\(a.rowOffset)</xdr:rowOff></xdr:from>\
        <xdr:to><xdr:col>\(b.column)</xdr:col><xdr:colOff>\(b.columnOffset)</xdr:colOff><xdr:row>\(b.row)</xdr:row><xdr:rowOff>\(b.rowOffset)</xdr:rowOff></xdr:to>\
        <xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>\
        <xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>\
        <xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="\(cx)" cy="\(cy)"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>\
        <xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>
        """
    }

    private func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private static let styles: String = {
        let medium = #"style="medium"><color auto="1"/>"#
        let thin = #"style="thin"><color auto="1"/>"#
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">"#
        xml += #"<numFmts count="1"><numFmt numFmtId="164" formatCode="[h]:mm"/></numFmts>"#
        xml += #"<fonts count="5">"#
        xml += #"<font><sz val="10"/><name val="Arial"/></font>"#
        xml += #"<font><b/><sz val="10"/><name val="Arial"/></font>"#
        xml += #"<font><sz val="20"/><name val="Arial"/></font>"#
        xml += #"<font><sz val="9"/><name val="Arial"/></font>"#
        xml += #"<font><i/><sz val="8"/><name val="Arial"/></font>"#
        xml += "</fonts>"
        xml += #"<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>"#
        xml += #"<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill></fills>"#
        xml += #"<borders count="7"><border><left/><right/><top/><bottom/><diagonal/></border>"#
        xml += "<border><left \(medium)</left><right \(medium)</right><top \(medium)</top><bottom \(medium)</bottom><diagonal/></border>"
        xml += "<border><left \(medium)</left><right \(thin)</right><top \(medium)</top><bottom \(medium)</bottom><diagonal/></border>"
        xml += "<border><left \(thin)</left><right \(medium)</right><top \(medium)</top><bottom \(medium)</bottom><diagonal/></border>"
        xml += "<border><left \(medium)</left><right/><top \(medium)</top><bottom \(medium)</bottom><diagonal/></border>"
        xml += "<border><left/><right/><top \(medium)</top><bottom \(medium)</bottom><diagonal/></border>"
        xml += "<border><left/><right \(medium)</right><top \(medium)</top><bottom \(medium)</bottom><diagonal/></border>"
        xml += "</borders>"
        xml += #"<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>"#
        xml += "<cellXfs count=\"\(XLStyle.allCases.count)\">"
        for style in XLStyle.allCases {
            let align = style.alignment
            xml += "<xf numFmtId=\"\(style.numFmtId)\" fontId=\"\(style.fontId)\" fillId=\"\(style.fillId)\" borderId=\"\(style.borderId)\" xfId=\"0\""
            xml += " applyNumberFormat=\"1\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\""
            xml += align.isEmpty ? "/>" : " applyAlignment=\"1\">\(align)</xf>"
        }
        xml += "</cellXfs>"
        xml += #"<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>"#
        return xml
    }()
}
