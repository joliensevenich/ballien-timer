import Foundation

/// Losgekoppeld van SwiftData, zodat de exporters puur met waarden werken.
struct ReportRow {
    var start: Date
    var end: Date
    /// Gewerkte tijd in hele minuten.
    var worked: TimeInterval
    var projectNumber: String
    var workType: String
    /// Leeg als er geen project gekozen is.
    var project: String
    var note: String

    var hours: Double { worked / 3600 }
}

struct ReportData {
    var userName: String
    var periodLabel: String
    var interval: DateInterval
    /// Oplopend gesorteerd op begintijd.
    var rows: [ReportRow]
    /// Keuzes voor "uitgevoerd werk" in de volgorde uit Instellingen.
    var workTypes: [String] = WorkTypes.defaults
    /// Week-, maand- of urenrapport.
    var layout: ReportLayout = .week
    /// Rapport met alleen privéwerk (gewoon werk en privéwerk staan nooit op hetzelfde rapport).
    var isPrivate = false

    var totalWorked: TimeInterval { rows.reduce(0) { $0 + $1.worked } }
    var daysWorked: Int { Set(rows.map { Calendar.current.startOfDay(for: $0.start) }).count }
    var showsProject: Bool { rows.contains { !$0.project.isEmpty } }

    /// Registraties per maand, oudste maand eerst.
    var months: [(month: Date, rows: [ReportRow])] {
        let cal = Calendar.current
        return Dictionary(grouping: rows) { cal.dateInterval(of: .month, for: $0.start)!.start }
            .map { (month: $0.key, rows: $0.value.sorted { $0.start < $1.start }) }
            .sorted { $0.month < $1.month }
    }

    var perProjectNumber: [(name: String, worked: TimeInterval)] {
        totals { $0.projectNumber.isEmpty ? "Zonder nummer" : $0.projectNumber }
    }

    var perWorkType: [(name: String, worked: TimeInterval)] {
        let totals = totals(by: \.workType)
        return totals.sorted {
            (workTypes.firstIndex(of: $0.name) ?? .max) < (workTypes.firstIndex(of: $1.name) ?? .max)
        }
    }

    private func totals(by key: (ReportRow) -> String) -> [(name: String, worked: TimeInterval)] {
        Dictionary(grouping: rows, by: key)
            .map { (name: $0.key, worked: $0.value.reduce(0) { $0 + $1.worked }) }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    /// "Uren_2026-10-01_2026-10-31", of "Prive_…" voor privéwerk
    var fileBaseName: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        let last = interval.end.addingTimeInterval(-1)
        return "\(isPrivate ? "Prive" : "Uren")_\(f.string(from: interval.start))_\(f.string(from: last))"
    }

    func exportURL(extension ext: String) throws -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("Export", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("\(fileBaseName).\(ext)")
    }
}

enum ReportFormat {
    static let locale = Locale(identifier: "nl_BE")

    /// "03-10-2026"
    static let date: DateFormatter = {
        let f = DateFormatter()
        f.locale = locale
        f.dateFormat = "dd-MM-yyyy"
        return f
    }()

    /// "oktober 2026"
    static let month: DateFormatter = {
        let f = DateFormatter()
        f.locale = locale
        f.dateFormat = "LLLL yyyy"
        return f
    }()

    static let time: DateFormatter = {
        let f = DateFormatter()
        f.locale = locale
        f.dateFormat = "HH:mm"
        return f
    }()

    static func monthTitle(_ date: Date) -> String {
        month.string(from: date).capitalized(with: locale)
    }

}
