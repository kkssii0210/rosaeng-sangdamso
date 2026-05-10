import "./globals.css";

export const metadata = {
  title: "슥구 성장 상담소",
  description: "로스트아크 캐릭터 성장 상담 메인 화면"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
