# POOPOO RUN

3레인 무한 러너 웹 게임입니다.

## Project structure

```text
index.html             # 앱 진입점
css/
  style.css            # 화면 스타일
js/
  config.js            # 디자인·밸런스 설정
  view.js              # 좌표 변환
  audio.js             # BGM·효과음
  render.js            # 캔버스 렌더링
  engine.js            # 게임 상태·규칙
  ui.js                # HUD·오버레이
  main.js              # 초기화·입력 연결
assets/
  audio/               # BGM 및 효과음
  images/
    backgrounds/       # 배경
    characters/        # 추격자 스프라이트
    environment/       # 공원 환경 스프라이트
    obstacles/         # 장애물 스프라이트
    ui/                # 버튼·패널 등 UI 이미지
  reference/           # 원본 디자인 참고 이미지
```

## Run locally

```bash
python -m http.server 8321
```

Open `http://localhost:8321/` in a browser.
