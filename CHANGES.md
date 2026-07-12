# 📋 CHANGES.md – Tổng hợp thay đổi dự án ProductIntro
> **Tác giả:** Võ Nguyên Thiên Phú – SE201591  
> **Cập nhật lần cuối:** 2026-07-11  
> **Database:** SQL Server – `ProductIntro`

---

## 🗂️ Tổng quan kiến trúc

Dự án sử dụng mô hình **MVC thuần Java Servlet + JSP** (không dùng Spring/Hibernate).

```
WorkShop1/
├── src/java/
│   ├── controller/      ← Servlet controllers (HTTP handler)
│   ├── model/           ← DAO + Entity classes
│   └── utilities/       ← ConnectDB (kết nối SQL Server)
├── web/
│   ├── WEB-INF/
│   │   ├── views/       ← JSP views (_header, _navbar, _adminSidebar, ...)
│   │   └── web.xml      ← Servlet & Filter mappings
│   ├── css/style.css
│   ├── sql/             ← SQL setup scripts
│   └── index.jsp        ← Landing page
```

---

## ✅ Workshop 1 – Nền tảng ban đầu

### Database tables (sẵn có)
| Bảng | Mô tả |
|---|---|
| `products` | Sản phẩm (productId, productName, productImage, brief, postedDate, typeId, account, unit, price, discount) |
| `categories` | Danh mục sản phẩm (typeId, categoryName, memo) |
| `accounts` | Tài khoản admin (account, pass, lastName, firstName, birthday, gender, phone, isUse, roleInSystem) |

### Controllers (public)
| URL | File | Chức năng |
|---|---|---|
| `/products` | `ProductListController.java` | Danh sách sản phẩm công khai |
| `/product` | `ProductDetailController.java` | Chi tiết sản phẩm |

### Controllers (admin – `/admin/*`)
| URL | File | Chức năng |
|---|---|---|
| `/admin/dashboard` | `DashboardController.java` | Trang tổng quan admin |
| `/admin/products` | `AdminProductListController.java` | Danh sách sản phẩm (admin) |
| `/admin/addProduct` | `AddProductController.java` | Thêm sản phẩm mới |
| `/admin/updateProduct` | `ProductUpdateController.java` | Sửa sản phẩm |
| `/admin/categories` | `CategoryListController.java` | Danh sách danh mục |
| `/admin/addCategory` | `AddCategoryController.java` | Thêm danh mục |
| `/admin/updateCategory` | `CategoryUpdateController.java` | Sửa danh mục |
| `/admin/accounts` | `AccountListController.java` | Danh sách tài khoản (Admin only) |
| `/admin/addAccount` | `AddAccountController.java` | Thêm tài khoản |
| `/admin/updateAccount` | `AccountUpdateController.java` | Sửa tài khoản |
| `/login` | `LoginController.java` | Đăng nhập |
| `/logout` | `LogoutController.java` | Đăng xuất |

### Model classes
| File | Mô tả |
|---|---|
| `Product.java` | Entity sản phẩm, có getter getFinalPrice() tính giá sau giảm |
| `Category.java` | Entity danh mục |
| `Account.java` | Entity tài khoản admin |
| `ProductDAO.java` | CRUD + filter/search sản phẩm |
| `CategoryDAO.java` | CRUD danh mục |
| `AccountDAO.java` | CRUD tài khoản, xác thực đăng nhập |
| `Accessible.java` | Interface generic: insertRec, updateRec, deleteRec, getObjectById, listAll |
| `ConnectDB.java` | Kết nối SQL Server qua JDBC (đọc params từ web.xml) |

### Filters
| File | Mô tả |
|---|---|
| CharacterEncodingFilter (built-in Tomcat) | Encode UTF-8 toàn bộ request/response |

---

## 🆕 Workshop 2 – Các tính năng mới thêm vào

### 1. 🗄️ Schema Database mới (web/sql/workshop2_setup.sql)

Ba bảng mới được tạo, **chạy file SQL này 1 lần trước khi deploy**:

- `view_history` – Theo dõi lịch sử xem sản phẩm (anonymous, theo session)
- `cart_items` – Giỏ hàng theo session (không cần đăng nhập)
- `active_sessions` – Ngăn đăng nhập đồng thời nhiều trình duyệt (1 dòng / account)

---

### 2. 🛒 Giỏ hàng (/cart)

**File mới:**
- `CartController.java` – Xử lý GET (hiển thị) và POST (add/update/remove/clear)
- `CartDAO.java` – CRUD bảng cart_items, dùng SQL MERGE để upsert
- `CartItem.java` – Entity: id, sessionId, product, quantity, getLineTotal()
- `Cart.jsp` – Trang giỏ hàng đầy đủ (bảng items, cập nhật số lượng, xóa, tổng đơn)

**Cơ chế:** Giỏ hàng gắn theo HttpSession.getId() (không cần đăng nhập). Nếu đã có sản phẩm, tăng số lượng thay vì thêm dòng mới (UNIQUE constraint + MERGE).

**POST actions:**
| action | Params | Hành động |
|---|---|---|
| `add` | productId, qty | Thêm/tăng số lượng |
| `update` | cartItemId, qty | Cập nhật số lượng cụ thể |
| `remove` | cartItemId | Xóa 1 sản phẩm |
| `clear` | – | Xóa toàn bộ giỏ |

---

### 3. 👁️ Theo dõi lịch sử xem (view_history)

**File mới:**
- `ViewHistory.java` – Entity: id, sessionId, viewedAt, product
- `ViewHistoryDAO.java` – Các phương thức analytics:

| Method | Mô tả |
|---|---|
| `addView(sessionId, productId)` | Ghi lượt xem (bỏ qua trùng lặp trong vòng 1 giờ) |
| `getViewedProducts(sessionId)` | Lấy danh sách sản phẩm đã xem của session (max 20) |
| `analyzeSegment(sessionId)` | Phân tích phân khúc thu nhập theo avg finalPrice |
| `getTodayViewCount()` | Tổng lượt xem hôm nay |
| `getTopViewedProducts(topN)` | Top N sản phẩm được xem nhiều nhất |
| `getSegmentDistributionToday()` | Phân phối phân khúc hôm nay: int[]{low, medium, high} |

**Phân khúc thu nhập (dựa trên giá trung bình sản phẩm đã xem):**
| Phân khúc | Điều kiện |
|---|---|
| 💼 Thu nhập thấp | avg finalPrice < 5,000,000 VND |
| 🏠 Thu nhập trung bình | 5,000,000 ≤ avg < 15,000,000 VND |
| 💎 Thu nhập cao | avg ≥ 15,000,000 VND |

---

### 4. 🔐 Bảo mật – Ngăn đăng nhập đa trình duyệt

**File mới:**
- `ActiveSessionDAO.java` – CRUD bảng active_sessions
- `AuthFilter.java` – Servlet Filter áp dụng cho toàn bộ /admin/*

**Cơ chế:**
1. Đăng nhập thành công → LoginController gọi ActiveSessionDAO.registerSession() → lưu sessionId mới vào DB.
2. Mỗi request đến /admin/* → AuthFilter so sánh session.getId() với sessionId trong DB.
3. Nếu khác nhau → invalidate session cũ → redirect /login?kicked=true.
4. Đăng xuất → LogoutController xóa record trong active_sessions.

---

### 5. 📊 Dashboard nâng cấp

**DashboardController.java** bổ sung dữ liệu analytics từ ViewHistoryDAO:

| Attribute | Dữ liệu |
|---|---|
| `totalProducts` | Tổng số sản phẩm |
| `totalCategories` | Tổng số danh mục |
| `totalAccounts` | Tổng số tài khoản |
| `todayViews` | Lượt xem hôm nay |
| `topProducts` | Top 5 sản phẩm được xem nhiều nhất |
| `segLow / segMedium / segHigh` | Số session theo phân khúc hôm nay |

**Dashboard.jsp** hiển thị:
- 4 stat cards (tổng SP, danh mục, tài khoản [Admin only], lượt xem hôm nay)
- Bảng Top 5 sản phẩm được xem nhiều nhất
- Biểu đồ Doughnut (Chart.js) phân phối phân khúc khách hàng

---

### 6. 🔍 Lọc & Tìm kiếm sản phẩm nâng cao

**ProductDAO.java** thêm method mới:
- `searchByName(keyword)` – Tìm theo tên (LIKE, case-insensitive)
- `listWithFilters(categoryId, priceMin, priceMax, discountOnly, keyword, sortBy)` – Lọc đa tiêu chí

**ProductListController.java** parse query params: categoryId, keyword, priceMin, priceMax, discountOnly, sortBy

---

## 📁 Tóm tắt file mới/sửa (Workshop 2)

### File hoàn toàn MỚI (WS2)
| File | Loại |
|---|---|
| `src/java/controller/AuthFilter.java` | Filter bảo mật |
| `src/java/controller/CartController.java` | Giỏ hàng |
| `src/java/model/CartItem.java` | Entity giỏ hàng |
| `src/java/model/CartDAO.java` | DAO giỏ hàng |
| `src/java/model/ViewHistory.java` | Entity lịch sử xem |
| `src/java/model/ViewHistoryDAO.java` | DAO analytics |
| `src/java/model/ActiveSessionDAO.java` | DAO session bảo mật |
| `web/WEB-INF/views/Cart.jsp` | View giỏ hàng |
| `web/sql/workshop2_setup.sql` | SQL setup script |

### File được SỬA (WS2)
| File | Thay đổi |
|---|---|
| `LoginController.java` | + Đăng ký session, + xử lý ?kicked=true |
| `LogoutController.java` | + Xóa record active_sessions khi logout |
| `DashboardController.java` | + Analytics data từ ViewHistoryDAO |
| `ProductDAO.java` | + searchByName(), + listWithFilters() |
| `ProductListController.java` | + Parse filter params |
| `Dashboard.jsp` | + Stat card lượt xem, bảng top SP, biểu đồ phân khúc |
| `web.xml` | + AuthFilter mapping, + CartController mapping |

---

## ⚙️ Hướng dẫn setup nhanh

```
1. Chạy SQL:  web/sql/workshop2_setup.sql  (1 lần duy nhất)
2. Kiểm tra web.xml: hostAddress, dbName, dbPort, userName, userPass
3. Deploy lên Tomcat (NetBeans: Run Project)

URL:
  http://localhost:8080/WorkShop1/products         ← Trang công khai
  http://localhost:8080/WorkShop1/cart             ← Giỏ hàng
  http://localhost:8080/WorkShop1/login            ← Đăng nhập admin
  http://localhost:8080/WorkShop1/admin/dashboard  ← Dashboard
```

---

> File này được tạo tự động để tóm tắt toàn bộ source code. Cập nhật thủ công khi có thay đổi mới.
