import SwiftUI
import SwiftData

/// Gegevens die bij de klok al ingevuld zijn en meegenomen worden naar de manuele invoer.
struct EntryPrefill {
    var jobName: String
    var projectNumber: String
    var workType: String
    var note: String
    var isPrivate: Bool
}

/// Toevoegen (entry == nil) of bewerken van een registratie.
struct EntryEditView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var workTypeOptions: [WorkTypeOption]

    let entry: WorkEntry?

    @State private var jobName: String
    @State private var projectNumber: String
    @State private var workType: String
    /// Alleen de datum telt.
    @State private var day: Date
    /// Alleen uur en minuten tellen.
    @State private var startTime: Date
    @State private var endTime: Date
    @State private var stillRunning: Bool
    @State private var note: String
    @State private var isPrivate: Bool
    @State private var confirmDelete = false

    init(entry: WorkEntry?, prefill: EntryPrefill? = nil) {
        self.entry = entry
        let today = Date.now
        // Nieuwe registraties starten met de uren die je de vorige keer manueel ingaf.
        let defaults = UserDefaults.standard
        let lastStart = defaults.object(forKey: Self.lastStartKey) as? Int ?? 7 * 60 + 30
        let lastEnd = defaults.object(forKey: Self.lastEndKey) as? Int ?? 16 * 60
        _jobName = State(initialValue: entry?.jobName ?? prefill?.jobName ?? "")
        _projectNumber = State(initialValue: entry?.projectNumber ?? prefill?.projectNumber ?? "")
        _workType = State(initialValue: entry?.workType ?? prefill?.workType
                          ?? UserDefaults.standard.string(forKey: "lastWorkType")
                          ?? WorkTypes.defaults[0])
        _day = State(initialValue: entry?.start ?? today)
        _startTime = State(initialValue: entry?.start ?? Self.time(lastStart, on: today))
        _endTime = State(initialValue: entry?.end ?? (entry == nil ? Self.time(lastEnd, on: today) : today))
        _stillRunning = State(initialValue: entry?.isRunning ?? false)
        _note = State(initialValue: entry?.note ?? prefill?.note ?? "")
        _isPrivate = State(initialValue: entry?.isPrivate ?? prefill?.isPrivate ?? false)
    }

    private static let lastStartKey = "manualStartMinutes"
    private static let lastEndKey = "manualEndMinutes"

    private static func time(_ minutes: Int, on day: Date) -> Date {
        Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: day) ?? day
    }

    private static func minutes(of date: Date) -> Int {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }

    private var start: Date {
        Self.time(Self.minutes(of: startTime), on: day)
    }

    /// Een einduur vóór het beginuur valt op de volgende dag.
    private var endsNextDay: Bool {
        Self.minutes(of: endTime) < Self.minutes(of: startTime)
    }

    private var end: Date {
        let sameDay = Self.time(Self.minutes(of: endTime), on: day)
        return endsNextDay ? Calendar.current.date(byAdding: .day, value: 1, to: sameDay)! : sameDay
    }

    private var isValid: Bool {
        stillRunning || end > start
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Werfnaam") {
                        JobNameField(text: $jobName)
                            .multilineTextAlignment(.trailing)
                    }
                    LabeledContent("Werfnummer") {
                        ProjectNumberField(text: $projectNumber)
                            .multilineTextAlignment(.trailing)
                    }
                    Picker("Uitgevoerd werk", selection: $workType) {
                        WorkTypeChoices(names: WorkTypes.names(workTypeOptions), current: workType)
                    }
                    Toggle("Privéwerk", isOn: $isPrivate)
                } footer: {
                    Text("Privéwerk komt niet op het gewone rapport, maar op een apart privérapport.")
                }

                Section {
                    DatePicker("Datum", selection: $day, displayedComponents: .date)
                    DatePicker("Beginuur", selection: $startTime, displayedComponents: .hourAndMinute)
                    if entry?.isRunning == true {
                        Toggle("Klok loopt nog", isOn: $stillRunning)
                    }
                    if !stillRunning {
                        DatePicker("Einduur", selection: $endTime, displayedComponents: .hourAndMinute)
                        if endsNextDay {
                            Label("Eindigt de volgende dag", systemImage: "moon")
                                .font(.footnote)
                                .foregroundStyle(.orange)
                        }
                        LabeledContent("Uren", value: Fmt.duration(WorkedTime.minutes(from: start, to: end)))
                    }
                } header: {
                    Text("Tijd")
                }

                Section("Notitie") {
                    TextField("Wat heb je gedaan?", text: $note, axis: .vertical)
                        .lineLimit(2...6)
                }

                if !isValid {
                    Section {
                        Label("Begin- en einduur mogen niet gelijk zijn.", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }

                if entry != nil {
                    Section {
                        Button("Registratie verwijderen", role: .destructive) {
                            confirmDelete = true
                        }
                    }
                }
            }
            .navigationTitle(entry == nil ? "Uren manueel invoeren" : "Uren bewerken")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuleer") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Bewaar") { save() }
                        .disabled(!isValid)
                }
            }
            .confirmationDialog("Deze registratie verwijderen?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Verwijder", role: .destructive) {
                    if let entry { context.delete(entry) }
                    dismiss()
                }
            }
        }
    }

    private func save() {
        let target = entry ?? {
            let new = WorkEntry(start: start)
            context.insert(new)
            return new
        }()
        target.jobName = jobName.trimmingCharacters(in: .whitespaces)
        target.projectNumber = projectNumber.trimmingCharacters(in: .whitespaces)
        target.workType = workType
        target.start = start
        target.note = note
        target.isPrivate = isPrivate
        target.end = stillRunning ? nil : end
        if entry == nil {
            UserDefaults.standard.set(Self.minutes(of: startTime), forKey: Self.lastStartKey)
            UserDefaults.standard.set(Self.minutes(of: endTime), forKey: Self.lastEndKey)
        }
        dismiss()
    }
}
