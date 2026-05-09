plugins {
    java
    jacoco
    id("com.gradleup.shadow") version "9.4.1"
}

group = "dev.samsepiol"
version = "0.1.0"

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.release.set(21)
}

dependencies {
    compileOnly("io.papermc.paper:paper-api:1.21.8-R0.1-SNAPSHOT")
    implementation("com.google.code.gson:gson:2.13.2")
    testImplementation(platform("org.junit:junit-bom:5.13.4"))
    testImplementation("io.papermc.paper:paper-api:1.21.8-R0.1-SNAPSHOT")
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}

val coverageExcludes = listOf(
    "**/ChzzkDonationPlugin*",
    "**/command/**",
    "**/display/SidebarService*",
    "**/effect/**",
    "**/listener/**",
    "**/state/TargetService*"
)

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    executionData(layout.buildDirectory.file("jacoco/test.exec"))
    classDirectories.setFrom(layout.buildDirectory.dir("classes/java/main").map { directory ->
        fileTree(directory.asFile) {
            exclude(coverageExcludes)
        }
    })
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}

tasks.jacocoTestCoverageVerification {
    dependsOn(tasks.test)
    executionData(layout.buildDirectory.file("jacoco/test.exec"))
    classDirectories.setFrom(layout.buildDirectory.dir("classes/java/main").map { directory ->
        fileTree(directory.asFile) {
            exclude(coverageExcludes)
        }
    })
    violationRules {
        rule {
            limit {
                counter = "LINE"
                value = "COVEREDRATIO"
                minimum = "1.0".toBigDecimal()
            }
            limit {
                counter = "BRANCH"
                value = "COVEREDRATIO"
                minimum = "1.0".toBigDecimal()
            }
        }
    }
}

tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
}

tasks.shadowJar {
    archiveBaseName.set("chzzk-donation")
    archiveClassifier.set("")
}
