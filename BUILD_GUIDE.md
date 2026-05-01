# CLIK - Build Guide (EXE 생성 가이드)

## 사전 요구사항
- **Node.js** v18 이상 (https://nodejs.org)
- **Windows** PC (exe 빌드용)

## 빌드 단계

### 1. 의존성 설치
```bash
cd click-app
npm install
```

### 2. better-sqlite3 네이티브 모듈 리빌드
```bash
npm run rebuild
```
> 이 단계가 중요합니다. Electron용 네이티브 바이너리로 다시 빌드합니다.
> 에러 시: `npx electron-rebuild -f -w better-sqlite3`

### 3. 개발 모드 테스트 (권장)
```bash
npm run electron:dev
```
정상 동작 확인 후 빌드 진행.

### 4. Windows EXE 빌드
```bash
npm run electron:build:win
```

### 5. 빌드 결과
`release/` 폴더:
- `CLIK Setup 1.1.0.exe` — NSIS 설치 파일
- `win-unpacked/` — 설치 없이 실행 가능한 폴더 (CLIK.exe)

## 빌드가 안 될 때

### "Cannot find module" 에러
```bash
# node_modules 완전 삭제 후 재설치
rm -rf node_modules
npm install
npm run rebuild
npm run electron:build:win
```

### NSIS 인스톨러가 안 생기고 unpacked만 있을 때
1. `release/` 폴더 삭제 후 재빌드
2. 관리자 권한으로 터미널 실행
3. 바이러스 백신이 빌드를 차단하는 경우 일시 비활성화

### better-sqlite3 빌드 실패 시
```bash
# Windows 빌드 도구 설치 (관리자 권한)
npm install --global windows-build-tools
npm run rebuild
```

## 앱 아이콘 설정 (선택)
`public/icon.png` (512x512px 이상 PNG)를 넣고,
package.json의 `build.win`에 추가:
```json
"icon": "public/icon.png"
```
