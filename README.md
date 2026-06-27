# Vietlott Predictor

Ứng dụng Android dự đoán kết quả xổ số Vietlott dựa trên dữ liệu lịch sử, 4 mô hình thống kê và một mô hình AI tự học. Viết bằng **React Native (Expo SDK 51)**, hoạt động **offline** (lưu cục bộ bằng AsyncStorage), giao diện **tiếng Việt**, hỗ trợ **sáng/tối**, tối ưu cho Android 14+.

> ⚠️ Ứng dụng chỉ mang tính tham khảo/giải trí. Kết quả xổ số là ngẫu nhiên; không mô hình nào đảm bảo trúng thưởng.

## Tính năng

- **5 loại giải**: Power 6/55, Mega 6/45, Loto 5/35, Max 3D, Max 3D Pro.
- **Tải dữ liệu lịch sử** từ GitHub (`vietvudanh/vietlott-data`) và lưu offline; nút *Cập nhật dữ liệu* trên Trang chủ.
- **4 mô hình dự báo**: Ngẫu nhiên, Tần suất, Markov Chain, Thích ứng (AI) — có độ tin cậy riêng và tham số điều chỉnh được.
- **Nhập kết quả thực tế** (chọn ngày + nhập số) → tự so sánh với dự đoán → cập nhật thống kê.
- **AI tự học**: sau mỗi kết quả, mô hình Thích ứng tự điều chỉnh trọng số các thành phần theo hiệu suất đo được để tăng độ chính xác.
- **Thống kê & biểu đồ**: hiệu suất mô hình (cột), xu hướng độ chính xác (đường), tần suất số (heatmap), khuyến nghị mô hình tốt nhất.
- **Cài đặt**: mô hình mặc định, slider tham số, đặt lại mặc định, chủ đề sáng/tối/tự động.

## Lấy file APK

### Cách 1 — GitHub Actions tự build (khuyên dùng, không cần cài Android Studio)

1. Tạo repo mới trên GitHub và đẩy toàn bộ thư mục này lên (nhánh `main`):
   ```bash
   git init
   git add .
   git commit -m "Vietlott Predictor"
   git branch -M main
   git remote add origin https://github.com/<tài-khoản>/vietlott-predictor.git
   git push -u origin main
   ```
2. Mỗi lần push, workflow `.github/workflows/build-apk.yml` sẽ tự chạy. Vào tab **Actions** → chọn lần chạy mới nhất → mục **Artifacts** → tải **`vietlott-predictor-apk`**.
3. Giải nén, copy file `app-release.apk` sang điện thoại và cài (bật "Cài từ nguồn không xác định").

> Muốn có trang Release tải trực tiếp: tạo tag `git tag v1.0.0 && git push --tags`, APK sẽ được đính kèm vào Release.

### Cách 2 — Build trên máy của bạn

Yêu cầu: **Node 18+**, **JDK 17**, **Android SDK** (qua Android Studio), biến môi trường `ANDROID_HOME`.

```bash
npm install --legacy-peer-deps
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease         # Windows: gradlew.bat assembleRelease
```
APK nằm ở: `android/app/build/outputs/apk/release/app-release.apk`.

Chạy thử trên máy ảo/điện thoại đang cắm USB: `npx expo run:android`.

### Cách 3 — EAS Build (đám mây của Expo)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview   # xuất file .apk
```

## Kiểm thử logic

```bash
npm test     # chạy scripts/selftest.js: kiểm tra parser, 4 mô hình, AI tự học
```

## Cấu trúc

```
App.js                      Điểm vào, providers + điều hướng
src/
  constants.js              Cấu hình giải, mô hình, tham số, khóa lưu trữ
  theme.js                  Bảng màu sáng/tối
  utils.js                  Hàm tiện ích (định dạng ngày, %)
  context/AppContext.js     Trạng thái toàn cục + hành động (lưu, dự đoán, nhập KQ)
  storage/storage.js        Lớp bọc AsyncStorage
  data/parser.js            Phân tích .jsonl -> chuẩn hóa kỳ quay
  data/dataService.js       Tải dữ liệu GitHub + cache offline
  models/scoring.js         Hàm tính điểm (tần suất, Markov...)
  models/predict.js         Điều phối dự đoán 4 mô hình
  models/learning.js        AI tự học: đánh giá + điều chỉnh trọng số
  components/               UI dùng chung, quả bóng số, biểu đồ SVG
  navigation/index.js       Tab + Stack
  screens/                  Home, Prediction, ResultInput, History, Statistics, Settings
.github/workflows/build-apk.yml   CI tự biên dịch APK
```

## Ghi chú kỹ thuật

- `minSdkVersion 24`, `target/compileSdkVersion 34` (chạy tốt trên Android 14+).
- Tất cả tính năng hoạt động offline sau lần cập nhật dữ liệu đầu tiên.
- Dữ liệu/dự đoán/cài đặt lưu bằng AsyncStorage trên máy người dùng.
