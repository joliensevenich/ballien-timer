import Foundation
import SwiftData

// CloudKit-sync vereist: alle velden een standaardwaarde of optioneel,
// relaties optioneel en geen unieke constraints.

/// Werf uit oudere versies, toen werven als lijst werden bijgehouden. Nu staat de werfnaam als tekst
/// bij elke registratie (`WorkEntry.jobName`); bij het opstarten worden oude werven omgezet en verwijderd.
@Model
final class Job {
    var name: String = ""
    var colorHex: String = "#004990"
    var isArchived: Bool = false
    var createdAt: Date = Date()

    @Relationship(deleteRule: .nullify, inverse: \WorkEntry.job)
    var entries: [WorkEntry]? = []

    init(name: String, colorHex: String = "#004990") {
        self.name = name
        self.colorHex = colorHex
        self.createdAt = Date()
    }
}

/// Een keuze voor "uitgevoerd werk", aanpasbaar in Instellingen.
@Model
final class WorkTypeOption {
    var name: String = ""
    var sortOrder: Int = 0
    var createdAt: Date = Date()

    init(name: String, sortOrder: Int) {
        self.name = name
        self.sortOrder = sortOrder
        self.createdAt = Date()
    }
}

enum WorkTypes {
    static let defaults = ["Allerlei", "Zagen", "Afplakken", "CNC", "Monteren"]

    /// Oudere versies bewaarden een vaste sleutel in plaats van de naam.
    static let legacy = ["allerlei": "Allerlei", "zagen": "Zagen", "afplakken": "Afplakken",
                         "cnc": "CNC", "monteren": "Monteren"]

    /// Komma's en aanhalingstekens weg: die breken de keuzelijst in Excel.
    static func clean(_ name: String) -> String {
        name.replacingOccurrences(of: ",", with: " ")
            .replacingOccurrences(of: "\"", with: "")
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }

    /// Unieke namen in volgorde (iCloud kan tijdelijk dubbels opleveren).
    static func names(_ options: [WorkTypeOption]) -> [String] {
        var seen = Set<String>()
        return options
            .sorted { ($0.sortOrder, $0.createdAt) < ($1.sortOrder, $1.createdAt) }
            .map(\.name)
            .filter { seen.insert($0.lowercased()).inserted }
    }

    /// Bij het opstarten: standaardlijst eenmalig aanmaken, dubbels opruimen
    /// en oude registraties omzetten naar namen.
    @MainActor
    static func prepare(_ context: ModelContext) {
        let options = (try? context.fetch(FetchDescriptor<WorkTypeOption>())) ?? []
        let seededKey = "didSeedWorkTypes"
        if options.isEmpty && !UserDefaults.standard.bool(forKey: seededKey) {
            for (i, name) in defaults.enumerated() {
                context.insert(WorkTypeOption(name: name, sortOrder: i))
            }
        } else {
            var seen = Set<String>()
            for option in options.sorted(by: { $0.createdAt < $1.createdAt })
            where !seen.insert(option.name.lowercased()).inserted {
                context.delete(option)
            }
        }
        UserDefaults.standard.set(true, forKey: seededKey)

        let entries = (try? context.fetch(FetchDescriptor<WorkEntry>())) ?? []
        for entry in entries {
            if let name = legacy[entry.workTypeRaw] { entry.workTypeRaw = name }
            // Werven worden niet meer als lijst bijgehouden: de naam komt als tekst bij de registratie.
            if let job = entry.job {
                if entry.jobName.isEmpty { entry.jobName = job.name }
                entry.job = nil
            }
        }
        for job in (try? context.fetch(FetchDescriptor<Job>())) ?? [] {
            context.delete(job)
        }
        try? context.save()
    }
}

@Model
final class WorkEntry {
    var start: Date = Date()
    /// nil zolang de klok loopt.
    var end: Date?
    /// Gescand of getypt van het papier, bijv. "2024-118".
    var projectNumber: String = ""
    /// Naam van het uitgevoerde werk (zie `WorkTypeOption`).
    var workTypeRaw: String = "Allerlei"
    var note: String = ""
    var createdAt: Date = Date()
    /// Getypt of gescand van het papier, net als het werfnummer.
    var jobName: String = ""
    /// Privéwerk telt niet mee in het gewone rapport; het heeft een eigen rapport.
    var isPrivate: Bool = false
    /// Alleen nog voor het omzetten van oudere versies (zie `Job`).
    var job: Job?

    init(start: Date, end: Date? = nil, projectNumber: String = "", workType: String = "Allerlei",
         note: String = "", jobName: String = "", isPrivate: Bool = false) {
        self.start = start
        self.end = end
        self.projectNumber = projectNumber
        self.workTypeRaw = workType
        self.note = note
        self.jobName = jobName
        self.isPrivate = isPrivate
        self.createdAt = Date()
    }

    var isRunning: Bool { end == nil }

    var workType: String {
        get { WorkTypes.legacy[workTypeRaw] ?? workTypeRaw }
        set { workTypeRaw = newValue }
    }

    /// Exacte gewerkte tijd in seconden.
    func exactWorked(at now: Date = .now) -> TimeInterval {
        max(0, (end ?? now).timeIntervalSince(start))
    }

    /// Gewerkte tijd in hele minuten, zoals op de klok: van 07:30 tot 16:15 is 8u45.
    func worked(at now: Date = .now) -> TimeInterval {
        WorkedTime.minutes(from: start, to: end ?? now)
    }
}

enum WorkedTime {
    /// Tijd tussen twee tijdstippen in hele minuten (seconden tellen niet mee), zonder afronding.
    static func minutes(from start: Date, to end: Date) -> TimeInterval {
        let from = (start.timeIntervalSince1970 / 60).rounded(.down)
        let to = (end.timeIntervalSince1970 / 60).rounded(.down)
        return max(0, (to - from) * 60)
    }
}

extension Collection where Element == WorkEntry {
    /// Totaal van de gewerkte tijd.
    func totalWorked(at now: Date = .now) -> TimeInterval {
        reduce(0) { $0 + $1.worked(at: now) }
    }
}
