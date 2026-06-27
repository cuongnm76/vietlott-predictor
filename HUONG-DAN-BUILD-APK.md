# Hướng dẫn tạo file cài đặt APK — cách đơn giản nhất

Mục tiêu: có **1 file `.apk`** để copy sang điện thoại Android và cài trực tiếp (không qua cửa hàng).

Bạn **không cần cài Android Studio**. Cách dễ nhất là dùng **EAS Build** — máy chủ của Expo biên dịch giúp bạn trên đám mây, rồi đưa link tải file APK về.

---

## CÁCH 1 — EAS Build (khuyên dùng, dễ nhất)

Cần: máy tính có internet, làm 1 lần ~20 phút. Không cần biết lập trình.

### Bước 1: Cài Node.js
- Vào https://nodejs.org → tải bản **LTS** → cài như phần mềm bình thường (bấm Next đến hết).

### Bước 2: Tạo tài khoản Expo (miễn phí)
- Vào https://expo.dev → **Sign up** → tạo tài khoản (nhớ email + mật khẩu).

### Bước 3: Mở Terminal trong thư mục dự án
- Giải nén `vietlott-predictor.zip`.
- **Windows**: mở thư mục `vietlott-predictor`, gõ `cmd` vào thanh địa chỉ rồi Enter (mở Command Prompt ngay tại đó).
- **Mac**: chuột phải thư mục → "New Terminal at Folder".

### Bước 4: Gõ lần lượt các lệnh (mỗi dòng Enter, chờ xong rồi gõ dòng tiếp)
```bash
npm install -g eas-cli
npm install
eas login
eas build -p android --profile preview
```
- `eas login`: nhập email + mật khẩu Expo ở Bước 2.
- Khi hỏi *"Generate a new Android Keystore?"* → gõ **Y** rồi Enter (Expo tự tạo và giữ khóa ký giúp bạn).

### Bước 5: Tải file APK
- Chờ ~10–20 phút. Khi xong, terminal hiện 1 **đường link**. Mở link đó trên trình duyệt → bấm **Download** → nhận file `.apk`.
- (Hoặc vào https://expo.dev → dự án → **Builds** để tải.)

### Bước 6: Cài lên điện thoại
1. Copy file `.apk` sang điện thoại (qua USB, Zalo, Google Drive, email…).
2. Trên điện thoại, mở file → Android hỏi quyền → vào **Cài đặt → cho phép cài từ nguồn này** → quay lại cài.
3. Mở app, bấm **Cập nhật dữ liệu** ở Trang chủ một lần để tải dữ liệu lịch sử. Sau đó dùng offline.

> Xong! File `.apk` này dùng cài cho bất kỳ điện thoại Android nào (Android 7 trở lên).

---

## CÁCH 2 — GitHub Actions (không cần cài gì trên máy)

Nếu không muốn cài Node.js, dùng cách này: đẩy code lên GitHub, máy chủ tự build APK.

1. Tạo tài khoản tại https://github.com (miễn phí).
2. Tạo repository mới (ví dụ tên `vietlott-predictor`), để **Public** hoặc Private đều được.
3. Tải code lên: cách dễ nhất là cài **GitHub Desktop** (https://desktop.github.com), kéo thả thư mục `vietlott-predictor` vào, bấm **Commit** rồi **Push**.
4. Trên trang GitHub của repo → tab **Actions** → đợi chạy xong (~10–15 phút, có dấu ✓ xanh).
5. Bấm vào lần chạy đó → kéo xuống mục **Artifacts** → tải **`vietlott-predictor-apk`** → giải nén ra file `.apk`.
6. Cài lên điện thoại như Bước 6 ở Cách 1.

> Workflow đã được cài sẵn trong `.github/workflows/build-apk.yml`, tự chạy mỗi khi bạn đẩy code lên.

---

## Câu hỏi thường gặp

**Có cần internet khi dùng app không?**
Chỉ cần internet **lần đầu** để bấm "Cập nhật dữ liệu". Sau đó app chạy hoàn toàn offline.

**"App not installed" / không cài được?**
Thường do đang có bản cũ cùng tên — gỡ bản cũ rồi cài lại. Hoặc bạn chưa cho phép "cài từ nguồn không xác định".

**Cách 1 báo lỗi `eas: command not found`?**
Đóng terminal, mở lại, hoặc chạy `npx eas-cli build -p android --profile preview` thay cho `eas ...`.

**Muốn file nhỏ và tối ưu hơn?**
File từ profile `preview` đã là bản APK đầy đủ dùng được. Không cần chỉnh gì thêm.
