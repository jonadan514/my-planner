# My Planner

React/Vite 기반 개인 플래너 PWA와 Capacitor Android 앱이다. Android 앱에서는 Health Connect를 통해 삼성헬스 운동기록을 가져올 수 있다.

## 웹 개발

```bash
npm install
npm run dev
```

검증 명령:

```bash
npm run build
npm test
```

## Android 앱

필요 환경:

- JDK 21
- Android Studio와 Android SDK 36
- Android 9 이상 실기기
- 최신 삼성헬스 및 Health Connect

웹 빌드를 Android 프로젝트에 반영:

```bash
npm run android:sync
npm run android:open
```

Android Studio에서 연결한 실기기를 선택하고 `app`을 실행한다.

## 삼성헬스 운동 연동

1. 삼성헬스에서 `설정 > Health Connect`를 연다.
2. 삼성헬스에 운동 데이터 쓰기 권한을 허용한다.
3. My Planner Android 앱의 몸개선 화면에서 `운동 권한 연결`을 누른다.
4. 운동, 거리, 소모 열량, 심박 읽기 권한을 허용한다.
5. `지금 동기화`를 누르면 최근 30일의 삼성헬스 운동이 운동기록에 반영된다.

가져온 데이터는 기기의 My Planner 앱 저장소에만 보관되며 서버로 전송하지 않는다. 브라우저/PWA에서는 Android 건강 데이터 권한을 사용할 수 없으므로 수동 기록만 지원한다.
