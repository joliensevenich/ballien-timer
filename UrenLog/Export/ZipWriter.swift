import Foundation

/// Minimale ZIP-schrijver (zonder compressie). Genoeg om een .xlsx-bestand te maken.
struct ZipWriter {
    private var body = Data()
    private var centralDirectory = Data()
    private var entryCount: UInt16 = 0

    mutating func add(path: String, contents: Data, date: Date = Date()) {
        let name = Data(path.utf8)
        let crc = CRC32.checksum(contents)
        let (dosTime, dosDate) = Self.dosDateTime(date)
        let offset = UInt32(body.count)

        var local = Data()
        local.append(le32: 0x04034b50)
        local.append(le16: 20)          // versie nodig
        local.append(le16: 0x0800)      // UTF-8 bestandsnamen
        local.append(le16: 0)           // geen compressie
        local.append(le16: dosTime)
        local.append(le16: dosDate)
        local.append(le32: crc)
        local.append(le32: UInt32(contents.count))
        local.append(le32: UInt32(contents.count))
        local.append(le16: UInt16(name.count))
        local.append(le16: 0)
        local.append(name)
        body.append(local)
        body.append(contents)

        var central = Data()
        central.append(le32: 0x02014b50)
        central.append(le16: 20)        // gemaakt door
        central.append(le16: 20)        // versie nodig
        central.append(le16: 0x0800)
        central.append(le16: 0)
        central.append(le16: dosTime)
        central.append(le16: dosDate)
        central.append(le32: crc)
        central.append(le32: UInt32(contents.count))
        central.append(le32: UInt32(contents.count))
        central.append(le16: UInt16(name.count))
        central.append(le16: 0)         // extra
        central.append(le16: 0)         // commentaar
        central.append(le16: 0)         // schijf
        central.append(le16: 0)         // interne attributen
        central.append(le32: 0)         // externe attributen
        central.append(le32: offset)
        central.append(name)
        centralDirectory.append(central)

        entryCount += 1
    }

    func finalize() -> Data {
        var out = body
        let cdOffset = UInt32(out.count)
        out.append(centralDirectory)
        out.append(le32: 0x06054b50)
        out.append(le16: 0)
        out.append(le16: 0)
        out.append(le16: entryCount)
        out.append(le16: entryCount)
        out.append(le32: UInt32(centralDirectory.count))
        out.append(le32: cdOffset)
        out.append(le16: 0)
        return out
    }

    private static func dosDateTime(_ date: Date) -> (UInt16, UInt16) {
        let c = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        let time = (c.hour! << 11) | (c.minute! << 5) | (c.second! / 2)
        let day = ((max(c.year!, 1980) - 1980) << 9) | (c.month! << 5) | c.day!
        return (UInt16(time), UInt16(day))
    }
}

enum CRC32 {
    private static let table: [UInt32] = (0..<256).map { i in
        var c = UInt32(i)
        for _ in 0..<8 {
            c = (c & 1) != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1
        }
        return c
    }

    static func checksum(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xFFFFFFFF
        for byte in data {
            crc = table[Int((crc ^ UInt32(byte)) & 0xFF)] ^ (crc >> 8)
        }
        return crc ^ 0xFFFFFFFF
    }
}

private extension Data {
    mutating func append(le16 value: UInt16) {
        Swift.withUnsafeBytes(of: value.littleEndian) { append(contentsOf: $0) }
    }

    mutating func append(le32 value: UInt32) {
        Swift.withUnsafeBytes(of: value.littleEndian) { append(contentsOf: $0) }
    }
}
