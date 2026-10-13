import Foundation

/// Soort rapport, afhankelijk van de gekozen periode.
enum ReportLayout {
    /// Deze week, vorige week, of een zelf gekozen periode binnen één week.
    case week
    /// Deze maand of vorige maand.
    case month
    /// Zelf gekozen periode over meerdere weken.
    case period
}

/// Layout van het papieren formulier "Weekrapport - Atelier", ook gebruikt voor het maandrapport.
/// Excel krijgt één tabblad; de PDF één of meer A4-pagina's.
enum FormReport {
    static let dayNames = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]
    static let note = "Vul het aantal uren in (uren:minuten) en noteer hierbij de code van de uitgevoerde taak"
    /// Minimaal aantal lijnen op het formulier (lege lijnen om op papier aan te vullen).
    static let minimumLines = 20
    /// Bruikbare hoogte van een A4-pagina (marges van 24 pt) in pixels van het blad, als het blad de
    /// paginabreedte vult. Zoveel past er op één PDF-pagina, kop inbegrepen.
    static var pageHeight: Double {
        let sheetWidth = columnWidths.reduce(0) { $0 + XLSheet.columnPixels($1) }
        let scale = (595.2 - 48) / sheetWidth
        return (841.8 - 48) / scale
    }
    /// Hoogte van de grijze totaalregel onderaan.
    static let totalRowHeight = 38.0
    /// Hoogte van de grijze weekregels (weeknummer en uren per dag van de week).
    static let weekRowHeight = 26.0
    /// Breedte gedeeld door hoogte van `logo_excel.png`.
    static let logoAspect = 912.0 / 321.0

    /// A: werfnummer, B: werfnaam, daarna per dag een kolom uren en een kolom code.
    static let columnWidths: [Double] = [17, 34] + Array(repeating: [8.0, 5.0], count: 7).flatMap { $0 }

    fileprivate static var calendar: Calendar {
        var cal = Calendar(identifier: .iso8601)
        cal.timeZone = .current
        return cal
    }

    /// Korte code per uitgevoerd werk, zoals in de legende van het formulier (Z, A, C, M, …).
    static func codes(for names: [String]) -> [String: String] {
        let preferred = ["zagen": "Z", "afplakken": "A", "cnc": "C", "monteren": "M", "montage": "M", "allerlei": "AL"]
        var result: [String: String] = [:]
        var used = Set<String>()
        for name in names {
            if let code = preferred[name.lowercased()], !used.contains(code) {
                result[name] = code
                used.insert(code)
            }
        }
        for name in names where result[name] == nil {
            let letters = String(name.uppercased().filter(\.isLetter)).ifEmpty("X")
            var candidates = (1...min(3, letters.count)).map { String(letters.prefix($0)) }
            candidates += (2...99).map { "\(letters.prefix(1))\($0)" }
            let code = candidates.first { !used.contains($0) }!
            result[name] = code
            used.insert(code)
        }
        return result
    }

    /// Excel: één tabblad. Bij het afdrukken past Excel zoveel mogelijk lijnen op elke pagina en herhaalt het
    /// de kopregels (titel, naam, periode, legende en kolomtitels) bovenaan elke pagina.
    static func sheet(for report: ReportData) -> XLSheet {
        let form = makeForm(report)
        return build(form, items: form.items, slots: max(minimumLines, form.items.count), showTotal: true, excelPages: true)
    }

    /// PDF: één of meer A4-pagina's, elk met de kopregels en zoveel mogelijk lijnen.
    /// De totalen staan op de laatste pagina.
    static func pages(for report: ReportData) -> [XLSheet] {
        let form = makeForm(report)
        var probe = XLSheet(name: "", columnWidths: columnWidths)
        let headerRows = header(&probe, form)
        let headerHeight = (1...headerRows).reduce(0) { $0 + XLSheet.rowPixels(probe.rowHeight($1)) }
        let totalHeight = XLSheet.rowPixels(totalRowHeight)
        func height(_ item: Item) -> Double {
            switch item {
            case .week, .weekTotals: return XLSheet.rowPixels(weekRowHeight)
            case .line: return XLSheet.rowPixels(36)
            }
        }

        // Pagina's vullen tot ze vol zijn; een weekregel komt nooit alleen onderaan een pagina.
        var chunks: [[Item]] = []
        var current: [Item] = []
        var used = headerHeight
        for item in form.items {
            if used + height(item) > pageHeight && !current.isEmpty {
                var carry: [Item] = []
                if case .week = current.last! { carry.append(current.removeLast()) }
                chunks.append(current)
                current = carry
                used = headerHeight + carry.reduce(0) { $0 + height($1) }
            }
            current.append(item)
            used += height(item)
        }
        // De totaalregel moet op de laatste pagina passen.
        if used + totalHeight > pageHeight && current.count > 1 {
            let last = current.removeLast()
            chunks.append(current)
            current = [last]
        }
        chunks.append(current)

        return chunks.enumerated().map { i, items in
            // Eén pagina: aangevuld tot het formulier met minstens 20 lijnen.
            let slots = chunks.count == 1 ? max(minimumLines, items.count) : items.count
            var page = build(form, items: items, slots: slots, showTotal: i == chunks.count - 1, excelPages: false)
            if chunks.count > 1 {
                // Vanaf pagina 2 staan ook naam en periode in de voettekst.
                let number = "Pagina \(i + 1) van \(chunks.count)"
                page.footer = i == 0 ? XLFooter(center: number)
                    : XLFooter(left: form.userName, center: number, right: form.period)
            }
            return page
        }
    }

    // MARK: - Inhoud

    /// Eén lijn op het formulier: één werf, één uitgevoerd werk, één dag.
    private struct Line {
        var number: String
        var name: String
        var code: String
        /// 0 = maandag … 6 = zondag
        var day: Int
        var hours: Double
    }

    /// Een rij in de lijst: een weekregel met het weektotaal, een lijn, of (bij maand- en urenrapport)
    /// de grijze regel met de gewerkte uren per dag aan het einde van een week.
    private enum Item {
        case week(String, total: Double)
        case line(Line)
        case weekTotals([Double])

        var isLine: Bool { if case .line = self { return true } else { return false } }
    }

    private struct Form {
        var title: String
        var label: String
        var sheetName: String
        var layout: ReportLayout
        var from: Date
        var to: Date
        var items: [Item]
        /// Per weekdag (maandag … zondag)
        var totals: [Double]
        var legend: [String]
        var codes: [String: String]
        var userName: String

        /// "05-10-2026 – 11-10-2026"
        var period: String { "\(ReportFormat.date.string(from: from)) – \(ReportFormat.date.string(from: to))" }
    }

    private static func makeForm(_ report: ReportData) -> Form {
        let cal = calendar
        // Legende in de volgorde van het papieren formulier (Z, A, C, M), daarna de andere werken.
        let formOrder = ["zagen", "afplakken", "cnc", "monteren", "montage"]
        let extra = Set(report.rows.map(\.workType)).subtracting(report.workTypes).sorted()
        let legend = (report.workTypes + extra).enumerated().sorted {
            let a = formOrder.firstIndex(of: $0.element.lowercased()) ?? formOrder.count + $0.offset
            let b = formOrder.firstIndex(of: $1.element.lowercased()) ?? formOrder.count + $1.offset
            return a < b
        }.map(\.element)
        let codes = codes(for: legend)

        func monday(_ date: Date) -> Date { cal.dateInterval(of: .weekOfYear, for: date)!.start }
        func day(_ date: Date) -> Int { (cal.component(.weekday, from: date) + 5) % 7 }

        var from = cal.startOfDay(for: report.interval.start)
        var to = cal.startOfDay(for: report.interval.end.addingTimeInterval(-1))
        let title: String, label: String, sheetName: String
        // Privéwerk krijgt een eigen rapport.
        let place = report.isPrivate ? "PRIVÉ" : "ATELIER"
        switch report.layout {
        case .week:
            // Een weekrapport toont altijd de hele week, van maandag tot zondag.
            from = monday(report.interval.start)
            to = cal.date(byAdding: .day, value: 6, to: from)!
            title = "WEEKRAPPORT - \(place)"
            label = "WEEK:"
            sheetName = "Week \(cal.component(.weekOfYear, from: from))"
        case .month:
            title = "MAANDRAPPORT - \(place)"
            label = "MAAND:"
            sheetName = ReportFormat.monthTitle(from)
        case .period:
            title = "URENRAPPORT - \(place)"
            label = "PERIODE:"
            sheetName = "Rapport"
        }

        struct Key: Hashable {
            var number: String
            var name: String
            var workType: String
            var day: Int
        }

        var items: [Item] = []
        var totals = Array(repeating: 0.0, count: 7)
        let byWeek = Dictionary(grouping: report.rows) { monday($0.start) }
        for weekStart in byWeek.keys.sorted() {
            if report.layout != .week {
                let weekEnd = cal.date(byAdding: .day, value: 6, to: weekStart)!
                items.append(.week("Week \(cal.component(.weekOfYear, from: weekStart)):  "
                    + "\(ReportFormat.date.string(from: weekStart)) – \(ReportFormat.date.string(from: weekEnd))",
                    total: byWeek[weekStart]!.reduce(0) { $0 + $1.hours }))
            }
            // Werk je meerdere dagen aan dezelfde werf, dan krijgt elke dag een eigen lijn. De lijnen volgen
            // de week: eerst maandag (in de volgorde van werken), dan dinsdag, enzovoort.
            let grouped = Dictionary(grouping: byWeek[weekStart]!) {
                Key(number: $0.projectNumber, name: $0.project, workType: $0.workType, day: day($0.start))
            }
            let firstStart = grouped.mapValues { $0.map(\.start).min()! }
            let keys = grouped.keys.sorted {
                if firstStart[$0]! != firstStart[$1]! { return firstStart[$0]! < firstStart[$1]! }
                return $0.number.localizedStandardCompare($1.number) == .orderedAscending
            }
            var weekTotals = Array(repeating: 0.0, count: 7)
            for key in keys {
                let hours = grouped[key]!.reduce(0) { $0 + $1.hours }
                totals[key.day] += hours
                weekTotals[key.day] += hours
                items.append(.line(Line(number: key.number, name: key.name, code: codes[key.workType] ?? "",
                                        day: key.day, hours: hours)))
            }
            if report.layout != .week { items.append(.weekTotals(weekTotals)) }
        }

        return Form(title: title, label: label, sheetName: sheetName, layout: report.layout, from: from, to: to,
                    items: items, totals: totals, legend: legend, codes: codes, userName: report.userName)
    }

    // MARK: - Blad

    /// Het formulier met de kop, `slots` rijen (aangevuld met lege lijnen) en eventueel de totalen.
    private static func build(_ form: Form, items: [Item], slots: Int, showTotal: Bool, excelPages: Bool) -> XLSheet {
        var s = XLSheet(name: form.sheetName, columnWidths: columnWidths)
        let lastColumn = columnWidths.count - 1
        let headerRow = header(&s, form)
        let first = headerRow + 1

        // Lijnen en weekregels
        let hourColumns = (0..<7).map { XLSheet.column(2 + $0 * 2) }
        for i in 0..<slots {
            let row = first + i
            s.rowHeights[row] = 36
            switch i < items.count ? items[i] : nil {
            case .week(let text, let total):
                // Grijze weekregel met rechts "Totaal uren:" en het totaal van die week, als één grijs blok.
                let lines = items[(i + 1)...].prefix(while: \.isLine).count
                let range = hourColumns.map { "\($0)\(row + 1):\($0)\(row + max(lines, 1))" }.joined(separator: ",")
                s.rowHeights[row] = weekRowHeight
                s.merge(row, 0, to: row, lastColumn - 6, .text(text), .weekRow)
                s.merge(row, lastColumn - 5, to: row, lastColumn - 2, .text("Totaal uren:"), .weekTotalLabel)
                s.merge(row, lastColumn - 1, to: row, lastColumn, .formula("SUM(\(range))", cached: total / 24), .weekTotal)
            case .weekTotals(let totals):
                // Grijze regel met de gewerkte uren per dag van die week, zoals onderaan het weekrapport.
                let lines = items[..<i].reversed().prefix(while: \.isLine).count
                s.rowHeights[row] = weekRowHeight
                s.merge(row, 0, to: row, 1, .text("TOTAAL GEWERKTE UREN:"), .totalLabel)
                for (d, column) in hourColumns.enumerated() {
                    let sum = lines > 0 ? "SUM(\(column)\(row - lines):\(column)\(row - 1))" : "0"
                    s.merge(row, 2 + d * 2, to: row, 3 + d * 2, .formula(sum, cached: totals[d] / 24), .totalValue)
                }
            case let item:
                var line: Line?
                if case .line(let l) = item { line = l }
                s.set(row, 0, line.map { .text($0.number) } ?? .blank, .text)
                s.set(row, 1, line.map { .text($0.name) } ?? .blank, .text)
                for d in 0..<7 {
                    let filled = line?.day == d
                    // Excel bewaart tijd als deel van een dag; met opmaak [u]:mm toont het 9:45.
                    s.set(row, 2 + d * 2, filled ? .number(line!.hours / 24) : .blank, .hours)
                    s.set(row, 3 + d * 2, filled ? .text(line!.code) : .blank, .code)
                }
            }
        }

        if showTotal {
            let total = first + slots
            s.rowHeights[total] = totalRowHeight
            if form.layout == .week {
                // Weekrapport: totalen per dag
                s.merge(total, 0, to: total, 1, .text("TOTAAL GEWERKTE UREN:"), .totalLabel)
                for (d, column) in hourColumns.enumerated() {
                    s.merge(total, 2 + d * 2, to: total, 3 + d * 2,
                            .formula("SUM(\(column)\(first):\(column)\(total - 1))", cached: form.totals[d] / 24), .totalValue)
                }
            } else {
                // Maand- of urenrapport: één totaal, de som van de weektotalen bij de weekregels.
                let weekCell = XLSheet.column(lastColumn - 1)
                let weekRows = items.indices.filter { if case .week = items[$0] { return true } else { return false } }
                let range = weekRows.isEmpty ? "0" : weekRows.map { "\(weekCell)\(first + $0)" }.joined(separator: ",")
                s.merge(total, 0, to: total, 1, .text(form.layout == .month ? "TOTAAL MAAND:" : "TOTAAL PERIODE:"), .totalLabel)
                s.merge(total, 2, to: total, lastColumn, .formula("SUM(\(range))", cached: form.totals.reduce(0, +) / 24), .totalValue)
            }
        }

        // Afdrukken in Excel: kopregels bovenaan elke pagina; vanaf pagina 2 ook naam en periode in de voettekst.
        if excelPages {
            s.printTitleRows = 1...headerRow
            s.footer = XLFooter(left: XLFooter.literal(form.userName), center: "Pagina &P van &N",
                                right: XLFooter.literal(form.period))
            s.firstPageFooter = XLFooter(center: "Pagina &P van &N")
        }
        return s
    }

    /// Kop van het formulier (titel, logo, naam, periode, legende en kolomtitels); geeft de rij met kolomtitels terug.
    private static func header(_ s: inout XLSheet, _ form: Form) -> Int {
        let lastColumn = columnWidths.count - 1
        let legend = form.legend

        // Titel
        s.rowHeights[1] = 30
        s.merge(1, 0, to: 1, lastColumn, .text(form.title), .title)

        // Kop: naam, periode en legende
        let codeRows = max(2, (legend.count + 1) / 2)
        let noteRow = 3 + codeRows
        s.rowHeights[2] = 34
        s.merge(2, 2, to: 2, 3, .text("NAAM:"), .label)
        s.merge(2, 4, to: 2, 11, .text(form.userName), .value)
        s.merge(2, 12, to: 2, 15, .text("LEGENDE:"), .label)
        for r in 0..<codeRows {
            let row = 3 + r
            s.rowHeights[row] = 28
            for half in 0..<2 {
                let i = r * 2 + half
                let text = i < legend.count ? "\(form.codes[legend[i]] ?? ""): \(legend[i].uppercased())" : ""
                s.merge(row, 12 + half * 2, to: row, 13 + half * 2, .text(text), .legend)
            }
        }
        s.rowHeights[noteRow] = 40
        s.merge(noteRow, 12, to: noteRow, 15, .text(note), .note)

        let span = noteRow - 3 + 1
        let vanEnd = 3 + span / 2 - 1
        s.merge(3, 2, to: noteRow, 3, .text(form.label), .label)
        s.merge(3, 4, to: vanEnd, 11, .text("VAN   \(ReportFormat.date.string(from: form.from))"), .weekDate)
        s.merge(vanEnd + 1, 4, to: noteRow, 11, .text("TOT   \(ReportFormat.date.string(from: form.to))"), .weekDate)

        // Vak voor het logo
        s.merge(2, 0, to: noteRow, 1, .blank, .label)

        // Kolomtitels
        let header = noteRow + 1
        s.rowHeights[header] = 26
        s.set(header, 0, .text("WERFNUMMER:"), .label)
        s.set(header, 1, .text("WERFNAAM:"), .label)
        for (d, day) in dayNames.enumerated() {
            s.merge(header, 2 + d * 2, to: header, 3 + d * 2, .text(day), .label)
        }

        // Logo gecentreerd in het vak linksboven
        let areaWidth = XLSheet.columnPixels(columnWidths[0]) + XLSheet.columnPixels(columnWidths[1])
        let top = XLSheet.rowPixels(s.rowHeight(1))
        let areaHeight = (2...noteRow).reduce(0) { $0 + XLSheet.rowPixels(s.rowHeight($1)) }
        let width = min(areaWidth - 48, (areaHeight - 24) * logoAspect)
        let height = width / logoAspect
        s.image = XLImage(width: areaWidth, height: top + areaHeight,
                          content: XLRect(x: (areaWidth - width) / 2, y: top + (areaHeight - height) / 2, width: width, height: height))
        return header
    }
}

private extension String {
    func ifEmpty(_ fallback: String) -> String { isEmpty ? fallback : self }
}
