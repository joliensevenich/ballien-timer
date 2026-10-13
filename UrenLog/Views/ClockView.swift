import SwiftUI
import SwiftData

struct ClockView: View {
    @Environment(\.modelContext) private var context
    @Query(filter: #Predicate<WorkEntry> { $0.end == nil }, sort: \WorkEntry.start)
    private var running: [WorkEntry]
    @Query(sort: \WorkEntry.start, order: .reverse) private var entries: [WorkEntry]
    @Query private var workTypeOptions: [WorkTypeOption]

    @AppStorage("lastWorkType") private var draftWorkType = ""
    // Gegevens voor de volgende registratie, zolang je niet ingeklokt bent.
    @State private var draftJobName = ""
    @State private var draftPrivate = false
    @State private var draftProjectNumber = ""
    @State private var draftNote = ""
    @State private var addingManual = false
    @State private var editingRunning: WorkEntry?

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { timeline in
                ScrollView {
                    VStack(spacing: 20) {
                        Image("Logo")
                            .renderingMode(.template)
                            .resizable()
                            .scaledToFit()
                            .frame(height: 44)
                            .foregroundStyle(.primary)
                            .padding(.top, 4)
                        timerCard(now: timeline.date)
                        // Eerst de gegevens, dan de knoppen: zo is duidelijk dat ze bij elkaar horen.
                        VStack(spacing: 12) {
                            detailsCard
                            actionButtons
                        }
                        summary(now: timeline.date)
                    }
                    .padding()
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Klok")
            .navigationBarTitleDisplayMode(.inline)
            .sensoryFeedback(.success, trigger: running.count)
            .sheet(isPresented: $addingManual) {
                // Wat bij de klok al is ingevuld, wordt meegenomen naar de manuele invoer.
                EntryEditView(entry: nil, prefill: EntryPrefill(jobName: draftJobName, projectNumber: draftProjectNumber,
                                                                workType: draftWorkType, note: draftNote,
                                                                isPrivate: draftPrivate))
            }
            .sheet(item: $editingRunning) { entry in
                EntryEditView(entry: entry)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    // MARK: - Timer

    @ViewBuilder
    private func timerCard(now: Date) -> some View {
        let entry = running.first
        VStack(spacing: 16) {
            Text(Fmt.clock(entry?.exactWorked(at: now) ?? 0))
                .font(.system(size: 58, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .contentTransition(.numericText())

            Group {
                if let entry {
                    Text("Ingeklokt om \(Fmt.time(entry.start))")
                } else {
                    Text("Niet ingeklokt")
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
    }

    // MARK: - Knoppen

    @ViewBuilder
    private var actionButtons: some View {
        VStack(spacing: 12) {
            if let entry = running.first {
                Button {
                    entry.end = .now
                    resetDraft()
                } label: {
                    Label("Uitklokken", systemImage: "stop.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .controlSize(.large)

                Button("Begintijd aanpassen") {
                    editingRunning = entry
                }
                .font(.subheadline)
            } else {
                Button {
                    clockIn()
                } label: {
                    Label("Inklokken", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .controlSize(.large)

                Button {
                    addingManual = true
                } label: {
                    Label("Uren manueel invoeren", systemImage: "square.and.pencil")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
            }
        }
    }

    // MARK: - Gegevens van de registratie

    @ViewBuilder
    private var detailsCard: some View {
        if let entry = running.first {
            RunningDetails(entry: entry, workTypes: WorkTypes.names(workTypeOptions))
        } else {
            EntryDetailsForm(jobName: $draftJobName,
                             projectNumber: $draftProjectNumber,
                             workType: $draftWorkType,
                             note: $draftNote,
                             isPrivate: $draftPrivate,
                             workTypes: WorkTypes.names(workTypeOptions))
                .onAppear(perform: validateDraftWorkType)
                .onChange(of: workTypeOptions.count) { validateDraftWorkType() }
        }
    }

    // MARK: - Samenvatting

    @ViewBuilder
    private func summary(now: Date) -> some View {
        let today = Periods.day(containing: now)
        let week = Periods.week(containing: now)
        let month = Periods.month(containing: now)

        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatTile(title: "Vandaag",
                     value: Fmt.duration(entries.filter { today.contains($0.start) }.totalWorked(at: now)))
            StatTile(title: "Deze week",
                     value: Fmt.duration(entries.filter { week.contains($0.start) }.totalWorked(at: now)))
            StatTile(title: "Deze maand",
                     value: Fmt.duration(entries.filter { month.contains($0.start) }.totalWorked(at: now)))
        }
    }

    // MARK: - Acties

    private func clockIn() {
        let entry = WorkEntry(start: .now,
                              projectNumber: draftProjectNumber.trimmingCharacters(in: .whitespaces),
                              workType: draftWorkType,
                              note: draftNote,
                              jobName: draftJobName.trimmingCharacters(in: .whitespaces),
                              isPrivate: draftPrivate)
        context.insert(entry)
    }

    /// Valt terug op de eerste keuze als de vorige keuze niet meer in de lijst staat.
    private func validateDraftWorkType() {
        let names = WorkTypes.names(workTypeOptions)
        if !names.contains(draftWorkType), let first = names.first {
            draftWorkType = first
        }
    }

    private func resetDraft() {
        draftJobName = ""
        draftPrivate = false
        draftProjectNumber = ""
        draftNote = ""
    }
}

/// Velden van een lopende registratie, direct gekoppeld aan het model.
private struct RunningDetails: View {
    @Bindable var entry: WorkEntry
    let workTypes: [String]

    var body: some View {
        EntryDetailsForm(jobName: $entry.jobName,
                         projectNumber: $entry.projectNumber,
                         workType: $entry.workType,
                         note: $entry.note,
                         isPrivate: $entry.isPrivate,
                         workTypes: workTypes)
    }
}

private struct EntryDetailsForm: View {
    @Binding var jobName: String
    @Binding var projectNumber: String
    @Binding var workType: String
    @Binding var note: String
    @Binding var isPrivate: Bool
    let workTypes: [String]

    var body: some View {
        VStack(spacing: 0) {
            row("Werfnaam") {
                JobNameField(text: $jobName)
                    .multilineTextAlignment(.trailing)
            }
            Divider()
            row("Werfnummer") {
                ProjectNumberField(text: $projectNumber)
                    .multilineTextAlignment(.trailing)
            }
            Divider()
            row("Uitgevoerd werk") {
                Picker("Uitgevoerd werk", selection: $workType) {
                    WorkTypeChoices(names: workTypes, current: workType)
                }
                .labelsHidden()
            }
            Divider()
            Toggle("Privéwerk", isOn: $isPrivate)
                .frame(minHeight: 44)
            Divider()
            TextField("Notitie (optioneel)", text: $note, axis: .vertical)
                .lineLimit(1...3)
                .padding(.vertical, 12)
        }
        .padding(.horizontal, 16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func row(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        HStack {
            Text(title)
            Spacer(minLength: 12)
            content()
        }
        .frame(minHeight: 44)
    }
}

struct StatTile: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

/// Keuzes voor een Picker; een naam die niet (meer) in de lijst staat blijft zichtbaar.
struct WorkTypeChoices: View {
    let names: [String]
    let current: String

    var body: some View {
        ForEach(names, id: \.self) { Text($0).tag($0) }
        if !current.isEmpty && !names.contains(current) {
            Text(current).tag(current)
        }
    }
}
