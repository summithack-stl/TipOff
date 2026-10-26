// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "TipOff",
    platforms: [.iOS(.v16)],
    products: [
        // xtool expects exactly one library product, representing the app.
        .library(name: "TipOff", targets: ["TipOff"]),
    ],
    targets: [
        .target(name: "TipOff"),
    ]
)
