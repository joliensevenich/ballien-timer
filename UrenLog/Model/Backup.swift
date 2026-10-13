import Foundation
import SwiftData
import SwiftUI
import UniformTypeIdentifiers

/// Volledige back-up van alle registraties als JSON-bestand.
struct Backup: Codable {
    /// Werven uit oudere versies; nieuwe back-ups hebben een lege lijst (de naam staat bij elke registratie).
    struct JobRecord: Codable {
        var name: String
        var colorHex: String
        var isArchived: Bool
        var createdAt: Date
    }

    struct EntryRecord: Codable {
        var start: Date
        var end: Date?
        var projectNumber: String
        var workType: String
        var note: String
        var createdAt: Date
        /// Werfnaam, of nil.
        var job: String?
        /// true voor privéwerk; ontbreekt bij gewoon werk en in oudere back-ups.
        var isPrivate: Bool?
    }

    /// Instellingen: naam, herinnering en standaarduren. Zelfde sleutels als de Android-app;
    /// de dag van de herinnering is 1 = maandag … 7 = zondag.
    struct Settings: Codable {
        var userName: String?
        var backupReminder: Bool?
        var backupReminderDay: Int?
        var backupReminderMinutes: Int?
        var manualStartMinutes: Int?
        var manualEndMinutes: Int?
        var lastWorkType: String?

        static func current(_ defaults: UserDefaults = .standard) -> Settings {
            let weekday = defaults.object(forKey: "backupReminderWeekday") as? Int ?? 6
            return Settings(userName: defaults.string(forKey: "userName") ?? "",
                            backupReminder: defaults.bool(forKey: "backupReminder"),
                            // Calendar telt vanaf zondag = 1.
                            backupReminderDay: weekday == 1 ? 7 : weekday - 1,
                            backupReminderMinutes: defaults.object(forKey: "backupReminderMinutes") as? Int ?? 16 * 60,
                            manualStartMinutes: defaults.object(forKey: "manualStartMinutes") as? Int ?? 7 * 60 + 30,
                            manualEndMinutes: defaults.object(forKey: "manualEndMinutes") as? Int ?? 16 * 60,
                            lastWorkType: defaults.string(forKey: "lastWorkType"))
        }

        /// Wat ontbreekt (oudere back-ups) blijft zoals het is.
        func apply(to defaults: UserDefaults = .standard) {
            let day = 0..<(24 * 60)
            if let userName, !userName.trimmingCharacters(in: .whitespaces).isEmpty {
                defaults.set(userName, forKey: "userName")
            }
            if let backupReminderDay, (1...7).contains(backupReminderDay) {
                defaults.set(backupReminderDay == 7 ? 1 : backupReminderDay + 1, forKey: "backupReminderWeekday")
            }
            if let backupReminderMinutes, day.contains(backupReminderMinutes) {
                defaults.set(backupReminderMinutes, forKey: "backupReminderMinutes")
            }
            if let manualStartMinutes, day.contains(manualStartMinutes) {
                defaults.set(manualStartMinutes, forKey: "manualStartMinutes")
            }
            if let manualEndMinutes, day.contains(manualEndMinutes) {
                defaults.set(manualEndMinutes, forKey: "manualEndMinutes")
            }
            if let lastWorkType, !lastWorkType.isEmpty { defaults.set(lastWorkType, forKey: "lastWorkType") }
            // Als laatste, zodat de herinnering meteen met de juiste dag en het juiste uur gepland wordt.
            if let backupReminder { defaults.set(backupReminder, forKey: "backupReminder") }
        }
    }

    static let currentVersion = 1

    var version: Int
    var app: String
    var exportedAt: Date
    var jobs: [JobRecord]
    var entries: [EntryRecord]
    /// Keuzes voor "uitgevoerd werk" (ontbreekt in oudere back-ups).
    var workTypes: [String]?
    /// Ontbreekt in oudere back-ups.
    var settings: Settings?

    // MARK: - Maken

    init(context: ModelContext) throws {
        let entries = try context.fetch(FetchDescriptor<WorkEntry>(sortBy: [SortDescriptor(\.start)]))
        workTypes = WorkTypes.names(try context.fetch(FetchDescriptor<WorkTypeOption>()))
        settings = .current()
        version = Self.currentVersion
        app = "UrenLog"
        exportedAt = .now
        jobs = []
        self.entries = entries.map {
            EntryRecord(start: $0.start, end: $0.end, projectNumber: $0.projectNumber, workType: $0.workType,
                        note: $0.note, createdAt: $0.createdAt, job: $0.jobName.isEmpty ? nil : $0.jobName,
                        isPrivate: $0.isPrivate ? true : nil)
        }
    }

    func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(self)
    }

    static func decode(_ data: Data) throws -> Backup {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let backup: Backup
        do {
            backup = try decoder.decode(Backup.self, from: data)
        } catch {
            throw BackupError.unreadable
        }
        guard backup.app == "UrenLog" else { throw BackupError.unreadable }
        guard backup.version <= currentVersion else { throw BackupError.tooNew }
        return backup
    }

    static var fileName: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return "baillien-timer-backup-\(f.string(from: .now))"
    }

    // MARK: - Terugzetten

    struct ImportResult {
        var added: Int
        var skipped: Int
    }

    /// - Parameter replace: true wist eerst alle bestaande gegevens; false voegt samen
    ///   en slaat registraties over die al bestaan (zelfde begin, einde en projectnummer).
    func restore(into context: ModelContext, replace: Bool) throws -> ImportResult {
        if replace {
            try context.delete(model: WorkEntry.self)
            try context.delete(model: Job.self)
            if workTypes != nil { try context.delete(model: WorkTypeOption.self) }
        }

        if let workTypes {
            let current = WorkTypes.names(try context.fetch(FetchDescriptor<WorkTypeOption>()))
            var order = current.count
            for name in workTypes where !current.contains(where: { $0.lowercased() == name.lowercased() }) {
                context.insert(WorkTypeOption(name: name, sortOrder: order))
                order += 1
            }
        }

        var existing = Set<String>()
        if !replace {
            for entry in try context.fetch(FetchDescriptor<WorkEntry>()) {
                existing.insert(Self.key(start: entry.start, end: entry.end, projectNumber: entry.projectNumber))
            }
        }

        var result = ImportResult(added: 0, skipped: 0)
        for record in entries {
            let key = Self.key(start: record.start, end: record.end, projectNumber: record.projectNumber)
            guard !existing.contains(key) else {
                result.skipped += 1
                continue
            }
            existing.insert(key)
            let entry = WorkEntry(start: record.start,
                                  end: record.end,
                                  projectNumber: record.projectNumber,
                                  workType: WorkTypes.legacy[record.workType] ?? record.workType,
                                  note: record.note,
                                  jobName: record.job ?? "",
                                  isPrivate: record.isPrivate ?? false)
            entry.createdAt = record.createdAt
            context.insert(entry)
            result.added += 1
        }
        try context.save()
        settings?.apply()
        return result
    }

    private static func key(start: Date, end: Date?, projectNumber: String) -> String {
        let endPart = end.map { String(Int($0.timeIntervalSince1970)) } ?? "-"
        return "\(Int(start.timeIntervalSince1970))|\(endPart)|\(projectNumber)"
    }
}

enum BackupError: LocalizedError {
    case unreadable, tooNew

    var errorDescription: String? {
        switch self {
        case .unreadable: "Dit bestand is geen geldige back-up van e. baillien - Timer."
        case .tooNew: "Deze back-up is gemaakt met een nieuwere versie van e. baillien - Timer. Werk de app eerst bij."
        }
    }
}

/// Bestand voor `.fileExporter`.
struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }

    let data: Data

    init(data: Data) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
