# Thư viện tài nguyên 3D (`src/scene/assets`)

Thư viện dùng chung để dựng model linh kiện "v2" và đồ trang trí bàn làm việc. Mục tiêu: thêm một linh kiện mới = **viết 1 file spec + đăng ký 1 dòng**, không sửa code scene.

```
assets/
  units.ts        mm → đơn vị scene (CHỖ DUY NHẤT quy đổi)
  quality.ts      mức chi tiết (low / balanced / high) + ngân sách tam giác
  cache.ts        cache geometry / material / texture dùng chung (markShared)
  materials/      bảng vật liệu PBR: kim loại, nhựa, cao su, sơn, PCB, kính, thảm ESD...
  primitives/     khối dựng: hộp vát cạnh, trụ, lathe, extrude, chân thẳng/uốn/dẹt, lò xo, ren,
                  trục khía, vít xẻ rãnh, nhãn chữ, dây cáp, bakeStatic, ignoreRaycast
  builders/       hàm dựng theo khuôn: axial (điện trở, diode), radialLed, radialCan (tụ hóa, còi),
                  dipIc, transistorPackages (TO-92, TO-220), boxParts (nút nhấn, rơ-le, LDR),
                  displays (LED RGB, LED 7 đoạn, OLED), modules (HC-SR04, servo, động cơ DC),
                  batteryHolder, slideSwitch, potentiometer, terminalBlock, boardDetails,
                  common (chân thẳng / chân uốn, hướng mặt nhãn)
  pins/           chuẩn khai báo chân + vùng chạm (index.ts), lớp marker khi nối dây (markers.ts)
  specs/          mỗi linh kiện một file spec khai báo
  registry.ts     đăng ký spec → definitionId hiện có
```

Liên quan: `../models/index.ts` chọn bộ model (`modelSet: 'legacy' | 'v2'`), `../models/v2/buildComponent.ts` biến spec thành object scene, `../workbench/` dựng bàn làm việc từ chính thư viện này.

## Quy ước

| Hạng mục | Quy ước |
|---|---|
| Đơn vị | **Milimét thật** theo datasheet. Không nhân hệ số trong builder/spec; `SCENE_UNITS_PER_MM` (units.ts) được áp một lần trong `buildComponent.ts`. |
| Trục | Y hướng lên. Mặt board là mặt phẳng XZ. |
| Gốc tọa độ | Gốc model = anchor của linh kiện (`instance.position`), **Y = 0 là mặt trên board**. Chân kéo xuống dưới 0 (cắm vào lỗ). |
| Hướng chân | Chân THT đi xuống −Y, sâu `LEAD_DEPTH_MM` (3,2 mm). Khai báo `direction: 'down' | 'up' | 'side'` trong spec. |
| Vị trí chân | **Không khai báo trong spec.** Lấy từ `ComponentDefinition.pins[].localOffset` (domain) qua `ctx.pin(id)` / `ctx.pins`. Đây là nguồn duy nhất mà dây, bộ giải MNA, DRC, AI và marker cùng dùng. |
| Tên pin | Dùng đúng `id` trong `definitions.ts`. Spec chỉ thêm thông tin hiển thị (`role`, `direction`, `touchRadius`). |
| Vùng chạm chân | Mặc định bán kính 1,15 mm × cao 3,5 mm (bằng model cũ). `touchRadius` nhỏ hơn sẽ bị nâng lên mức này. |
| Geometry | Luôn lấy từ `primitives/` (đã cache theo khóa tham số). Không `new THREE.XxxGeometry` trong builder. |
| Material | Luôn lấy từ `Materials.*`. Không tạo material theo từng instance. |
| Khóa cache | Chỉ gồm giá trị **rời rạc** (kích thước của spec, mức chi tiết, màu trong bảng cố định). Giá trị liên tục của người dùng (góc xoay, điện áp) phải áp bằng transform, không đưa vào khóa. |
| Phần động | Mesh cần click / đổi material / animation: truyền `dynamic: true` để không bị gộp. |
| Nhãn chữ | `label()` chỉ dùng chuỗi cố định (texture được cache). Trong Node (không có canvas) nhãn bị bỏ qua, nên nhãn chỉ để trang trí. |
| Mô phỏng | Chỉ đọc `ctx.options` (kết quả bộ giải). Không tự đặt độ sáng / trạng thái. |

## Ngân sách tam giác (đã có test)

| Mức chất lượng | Một linh kiện (không tính vùng chạm) | Cả bàn làm việc |
|---|---|---|
| Thấp (`low`) | ≤ 700 | ≤ 6.000 |
| Chuẩn (`balanced`) | ≤ 2.600 | ≤ 40.000 |
| Cao (`high`) | ≤ 6.500 | ≤ 80.000 |

LOD theo mức chất lượng: mọi primitive nhận `detail` và tự giảm số đoạn; builder có thể bỏ chi tiết nhỏ khi `detail === 'low'`. Chưa có LOD theo khoảng cách camera.

`bakeStatic` gộp các mesh tĩnh cùng material thành một mesh, nên số draw call của một model ≈ số material nó dùng. Chi tiết lặp lại (chân, vít) dùng chung một geometry trong cache.

## Ví dụ: tạo một linh kiện mới từ đầu

Ví dụ dưới đây chính là spec có thật của **diode 1N4007** (`specs/diode.ts`; `definitionId: 'diode'`, chân `anode` / `cathode` đã có trong `definitions.ts`).

**Bước 1. Viết spec** `specs/diode.ts`. Diode là linh kiện axial nên dùng lại builder `axial`:

```ts
import { buildAxial } from '../builders/axial';
import { Materials } from '../materials';
import { defineSpec } from './types';

export const diodeSpec = defineSpec({
  id: 'diode-do41',
  definitionIds: ['diode'],
  reference: '1N4007 rectifier, DO-41 package: body 5.2 x 2.7 mm, lead 0.8 mm',
  builder: buildAxial,
  params: () => ({
    pinA: 'anode',
    pinB: 'cathode',
    bodyLength: 5.2,
    bodyDiameter: 2.7,
    leadDiameter: 0.8,
    standoff: 1.0,
    shape: 'cylinder' as const,
    bodyMaterial: Materials.plastic(0x18181b, 0.5),
    // Vạch bạc phía cathode
    bands: [{ hex: 0xe2e8f0, metallic: true, offset: 1.75, width: 0.85 }],
  }),
  pins: {
    anode: { role: 'power', direction: 'side' },
    cathode: { role: 'ground', direction: 'side' },
  },
});
```

**Bước 2. Đăng ký** trong `registry.ts`:

```ts
import { diodeSpec } from './specs/diode';
const SPECS = [ /* ... */ diodeSpec ];
```

Xong. `createComponentMesh` sẽ tự dùng spec này khi `modelSet === 'v2'`; `test/visual_assets.test.ts` tự kiểm tra pin ID, anchor và ngân sách tam giác cho mọi `definitionId` trong registry.

**Khi không có builder phù hợp**, viết builder mới trong `builders/`:

```ts
import { Materials } from '../materials';
import { chamferBox, leadFlat, part } from '../primitives';
import type { Builder } from '../specs/types';
import { LEAD_DEPTH_MM } from '../units';

export interface MyPartParams { width: number; height: number; depth: number }

export const buildMyPart: Builder<MyPartParams> = (ctx, p) => {
  // Thân: đáy cách board 0,5 mm
  part(ctx.group, chamferBox(p.width, p.height, p.depth, 0.3, ctx.detail), Materials.plastic(0x1b1e24), {
    at: [0, 0.5 + p.height / 2, 0],
  });
  // Mỗi chân một lá thiếc, đặt ĐÚNG anchor của definition
  for (const pin of ctx.pins) {
    part(ctx.group, leadFlat(0.5, LEAD_DEPTH_MM, 0.6, 0.3), Materials.tin(), { at: [pin.position.x, 0, pin.position.z] });
  }
};
```

Không cần tạo vùng chạm chân hay marker: `buildComponent.ts` tự tạo từ `definition.pins`.

## Checklist khi thêm linh kiện

- [ ] Kích thước lấy từ datasheet, ghi nguồn trong `reference`.
- [ ] Thân nằm trong `definition.dimensions` (DRC va chạm dùng hộp này). Nếu kích thước thật không vừa: **dừng, báo chủ dự án**, không tự sửa definition.
- [ ] Không thêm / đổi / dời pin. Chân vẽ đúng tại `ctx.pin(id)`. Nếu buộc phải dời anchor: **dừng, báo cáo**.
- [ ] Chỉ dùng `primitives/` và `Materials.*`; không tạo geometry / material riêng cho từng instance.
- [ ] Phần click được hoặc đổi theo mô phỏng có `dynamic: true`; hiệu ứng mô phỏng đặt tên `sim-glow`.
- [ ] Trạng thái hình ảnh chỉ đọc từ `instance.parameters`, `instance.state`, `ctx.options`.
- [ ] Đăng ký trong `registry.ts` (kèm các alias `definitionId` còn tồn tại trong `COMPONENT_DEFINITION_MAP`).
- [ ] `npx tsx test/visual_assets.test.ts` đạt (pin, anchor ≤ 0,01 so với legacy, ngân sách tam giác, dispose).
- [ ] Xem trên trang thử: `npx vite --port 5179` → `/test/harness/scene.html?p=library`, ở cả 3 mức chất lượng; so với bộ cũ bằng `?modelSet=legacy`.

## Bộ model cũ (legacy)

Model cũ được giữ nguyên tại `src/scene/models/legacy/proceduralModels.ts` (chỉ sửa đường dẫn import). Chuyển về bằng `?modelSet=legacy`, `localStorage['cc3d.modelSet'] = 'legacy'`, `window.__cc3dSetModelSet('legacy')` (dev) hoặc `VITE_MODEL_SET=legacy`. Linh kiện chưa có spec v2 luôn dùng model legacy. **Bộ legacy chỉ được gỡ khi chủ dự án xác nhận.**

## Trạng thái registry

23 spec cho 23 trong 25 linh kiện của thư viện. Không có spec (luôn dùng model legacy): `arduino-uno` và `breadboard` (dùng file GLB), hai định nghĩa đã deprecated `ultrasonic-sensor` và `servo-motor`, alias `terminal_block_2pin`.

## Xuất GLB

```bash
npm run export:models
```

Xuất mỗi model v2 ra `exports/models/<definitionId>.glb` (mặc định mức `high`; thêm `-- balanced` hoặc `-- low` để đổi mức). Đơn vị mm, Y hướng lên, Y = 0 là mặt board. Không xuất vùng chạm chân và nhãn chữ (texture canvas chỉ có trong trình duyệt). Script: `scripts/export-models.ts`.
