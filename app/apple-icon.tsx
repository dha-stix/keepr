import { ImageResponse } from "next/og";

// Home-screen icon for iPhone and iPad: Keepr's brass keycard on pine (iOS rounds the corners itself)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e4a3f" }}>
        <div style={{ width: 74, height: 124, borderRadius: 17, background: "#a87530", display: "flex", justifyContent: "center", paddingTop: 20 }}>
          <div style={{ width: 40, height: 14, borderRadius: 7, background: "#f2f3ef" }} />
        </div>
      </div>
    ),
    size,
  );
}
