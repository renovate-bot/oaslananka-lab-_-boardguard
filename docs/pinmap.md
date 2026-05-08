# Pinmap

Pinmap input is optional and experimental.

```yaml
version: 1
pins:
  - designator: U1
    pin: "1"
    net: MCU_PA0
    firmware: PA0
```

v0.1 validates the schema and checks whether declared nets appear in extracted schematic labels. It does not claim full firmware synchronization.
