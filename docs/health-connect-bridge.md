# Health Connect 네이티브 브리지 경계

현재 `my-planner`는 브라우저 PWA이므로 Health Connect SDK를 직접 호출할 수 없다. Android 래퍼를 추가할 때 WebView에 `window.HealthConnectBridge`를 주입하면 웹 기능을 교체하지 않고 동기화를 활성화할 수 있다.

## 필요한 메서드

```ts
interface HealthConnectBridge {
  getStatus(): Promise<{
    available: boolean
    grantedDataTypes: Array<'EXERCISE' | 'STEPS' | 'SLEEP' | 'WEIGHT' | 'BODY_FAT'>
  }>

  requestReadPermissions(dataTypes: HealthDataType[]): Promise<BridgeStatus>

  readRecords(input: {
    dataTypes: HealthDataType[]
    startTime: string
    changeTokens?: Partial<Record<HealthDataType, string>>
  }): Promise<{
    records: HealthRecord[]
    changeTokens?: Partial<Record<HealthDataType, string>>
  }>
}
```

## 원칙

- 읽기 권한만 요청한다.
- 최초 요청의 `startTime`은 최근 30일이다.
- 외부 레코드는 `sourcePackage + dataType + externalRecordId` 조합으로 upsert한다.
- 운동과 체중 자동 기록은 기존 수동 기록을 덮어쓰지 않는다.
- 걸음·수면·체지방은 원본 `healthRecords`에 저장한다.
- GPS 경로는 반환하거나 저장하지 않는다.
- 브리지가 없거나 권한이 없어도 모든 수동 기록 기능은 계속 동작한다.
