import SwiftUI
import VisionKit

/// Camera die tekst herkent; tik op de tekst (werfnummer of werfnaam) om ze over te nemen.
struct ScannerSheet: View {
    /// Wat gescand wordt, bv. "werfnummer" of "werfnaam".
    var subject = "werfnummer"
    let onScan: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    TextScannerView(onScan: onScan)
                        .ignoresSafeArea(edges: .bottom)
                        .overlay(alignment: .bottom) {
                            Text("Richt de camera op het papier en tik op de \(subject).")
                                .font(.callout)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(.regularMaterial, in: Capsule())
                                .padding(.bottom, 30)
                                .padding(.horizontal)
                        }
                } else if !DataScannerViewController.isSupported {
                    ContentUnavailableView("Scannen niet ondersteund",
                                           systemImage: "camera.badge.ellipsis",
                                           description: Text("Dit toestel kan geen tekst scannen. Typ de \(subject) in."))
                } else {
                    ContentUnavailableView("Geen toegang tot camera",
                                           systemImage: "camera.badge.ellipsis",
                                           description: Text("Geef e. baillien - Timer toegang tot de camera via Instellingen > Privacy > Camera."))
                }
            }
            .navigationTitle("\(subject.prefix(1).uppercased() + subject.dropFirst()) scannen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuleer") { dismiss() }
                }
            }
        }
    }
}

private struct TextScannerView: UIViewControllerRepresentable {
    let onScan: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.text()],
            qualityLevel: .accurate,
            recognizesMultipleItems: true,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {
        if !scanner.isScanning {
            try? scanner.startScanning()
        }
    }

    static func dismantleUIViewController(_ scanner: DataScannerViewController, coordinator: Coordinator) {
        scanner.stopScanning()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onScan: onScan)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void

        init(onScan: @escaping (String) -> Void) {
            self.onScan = onScan
        }

        func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {
            guard case let .text(text) = item else { return }
            let value = text.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty else { return }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onScan(value)
        }
    }
}
