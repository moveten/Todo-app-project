# 일정관리 D-day 앱

Vite + React로 만든 개인용 일정관리 앱입니다. 데이터는 브라우저의 localStorage에 저장됩니다 (기기/브라우저별로 별도 저장, 서버 저장 아님).

## 로컬에서 실행

```bash
npm install
npm run dev
```

## GitHub에 올리기

1. https://github.com/new 에서 새 저장소 생성 (예: `todo-dday-app`), Public/Private 아무거나 선택. README/gitignore는 추가하지 않기(이미 있음).
2. 이 폴더에서:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<내-아이디>/todo-dday-app.git
git push -u origin main
```

## Vercel로 배포하기

1. https://vercel.com 에 GitHub 계정으로 로그인
2. "Add New… → Project" 클릭
3. 방금 올린 GitHub 저장소(`todo-dday-app`) 선택 → Import
4. Framework Preset이 자동으로 "Vite"로 잡힙니다. Build Command `npm run build`, Output Directory `dist` 그대로 두고 Deploy 클릭
5. 몇십 초 후 `https://todo-dday-app-....vercel.app` 같은 주소가 생성됩니다. 이후 GitHub에 push할 때마다 자동으로 재배포됩니다.

## 주의사항

- 데이터는 각 기기/브라우저의 localStorage에만 저장돼요. 다른 기기에서 접속하면 다른 데이터로 보입니다. 여러 기기에서 동기화하려면 별도의 백엔드(DB)가 필요해요 — 필요하면 요청해 주세요.
- 시크릿/프라이빗 브라우징 모드에서는 저장이 유지되지 않을 수 있어요.
