tasks.register("test") {
    dependsOn(":plugin:test")
}

tasks.register("shadowJar") {
    dependsOn(":plugin:shadowJar")
}
