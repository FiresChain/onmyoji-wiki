import fs from 'node:fs'
import path from 'node:path'

const FLOW_ROOT = path.resolve('public', 'data', 'flows')
const VI_FLOW_ROOT = path.join(FLOW_ROOT, 'vi')
const SOURCE_PREFIX = 'wiki-editor-bundle-1782887841178-flow-'

const sharedSubtitle = '<p style="margin:0;text-align:left;font-size:24px;line-height:1.45;">Hướng dẫn này là lộ trình top 100 thông thường, không dùng thức thần liên động.</p>'

const flowTextByFile = {
  'wiki-editor-bundle-1782887841178-flow-1.json': {
    title: '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><strong>【Sơn Thố đua tốc top 100】Tầng 1-3</strong></p>',
    team: '【Sơn Thố đua tốc top 100】Tầng 1-3 · Đội hình',
    detail: [
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Tốc độ: Tamamo &gt;<strong style="color: rgb(0, 71, 178);">190</strong>&gt; còn lại (<strong style="color: rgb(153, 51, 255);">có tư chất 4</strong>: Ràng buộc → mở Truyện ký 4 → đổi nhanh)</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Cấu hình: chỉ số Tamamo-no-Mae <strong style="color: rgb(0, 71, 178);">1.3w+</strong></p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Thao tác: P1-3 👉 Tamamo dùng chiêu cuối toàn bộ</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Ghi chú: ① Daruma trắng <strong style="color: rgb(153, 51, 255);">không nên đổi sang Magatsuhi</strong> (đồng đội bị ếch đánh thấp máu, tạo khiên sẽ tốn thời gian)</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>② <strong style="color: rgb(0, 71, 178);">Nếu chưa build Tamamo</strong>, có thể đổi sang Amaterasu/Asura cùng mốc tốc (<strong style="color: rgb(107, 36, 178);">nhưng tốn thời gian hơn</strong>); Daruma trắng có thể đổi sang Shuten, SP Menreiki, Oitsuki, Aoandon...</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>③ <strong style="color: rgb(0, 71, 178);">Route 10s</strong>: Ibaraki đánh thường quái nhỏ + cược điểm ếch thấp (rất phụ thuộc RNG, <strong style="color: rgb(0, 71, 178);">không khuyến nghị</strong>)</p>'
    ].join('')
  },
  'wiki-editor-bundle-1782887841178-flow-2.json': {
    title: '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><strong>【Sơn Thố đua tốc top 100】Tầng 4-5</strong></p>',
    team: '【Sơn Thố đua tốc top 100】Tầng 4-5 · Đội hình',
    detail: [
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Tốc độ: Amaterasu &gt;<strong style="color: rgb(0, 71, 178);">210</strong>&gt; còn lại</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Cấu hình: chỉ số Amaterasu khoảng <strong style="color: rgb(0, 71, 178);">1.6w</strong> (không được quá cao!!!)</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Thao tác: P1 ☞ Amaterasu dùng chiêu cuối, để Kính Cơ phản và dọn (chỉ được kích <strong style="color: rgb(0, 71, 178);">1 lần Kính Cơ</strong>); P2 ☞ Amaterasu dùng chiêu cuối dọn</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Thao tác:</span>P3 ☞ Amaterasu dùng chiêu cuối dọn (kích Kính Cơ; <strong style="color: rgb(153, 51, 255);">có linh thú Ti Hồn để tăng độ an toàn, bảo đảm DPS chưa chết ngay</strong>)</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Ghi chú: ① Muốn đánh 11s ☞ <strong style="color: rgb(0, 71, 178);">P2 điểm ếch ≤ 3 + không kẹt giây</strong> (khá <strong style="color: rgb(153, 51, 255);">phụ thuộc RNG</strong>, ưu tiên clear trước rồi tối ưu thời gian)</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>② Thêm linh thú Ti Hồn chỉ tăng độ an toàn, route vẫn có độ khó!</p>'
    ].join('')
  },
  'wiki-editor-bundle-1782887841178-flow-3.json': {
    title: '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><strong>【Sơn Thố đua tốc top 100】Tầng 6</strong></p>',
    team: '【Sơn Thố đua tốc top 100】Tầng 6 · Đội hình',
    detail: [
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Tốc độ: SP Orochi &gt;<strong style="color: rgb(0, 71, 178);">220</strong>&gt; còn lại</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Cấu hình: chỉ số SP Orochi <strong style="color: rgb(0, 71, 178);">1.6w+</strong>, <strong style="color: rgb(153, 51, 255);">ATK cao nhất</strong>, <strong style="color: rgb(0, 71, 178);">ATK Shokurei thấp hơn SP Orochi</strong></p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Thao tác: P1-3 SP Orochi dùng chiêu cuối dọn</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Ghi chú: ① Muốn 17s cần <strong style="color: rgb(0, 71, 178);">P2 điểm ếch ≤ 2 + không kích nội tại Ebisu gây kẹt giây</strong> (có thể làm được nhưng <strong style="color: rgb(153, 51, 255);">phụ thuộc RNG</strong>)</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>② Nếu có điều kiện, thức thần hỗ trợ mang <strong style="color: rgb(153, 51, 255);">bộ 2 Địa Chấn Niêm</strong></p>'
    ].join('')
  },
  'wiki-editor-bundle-1782887841178-flow-4.json': {
    title: '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><strong>【Sơn Thố đua tốc top 100】Tầng 7-8</strong></p>',
    team: '【Sơn Thố đua tốc top 100】Tầng 7-8 · Đội hình',
    detail: [
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Tốc độ: Amaterasu &gt;<strong style="color: rgb(0, 71, 178);">230</strong>&gt; Izanami &gt;<strong style="color: rgb(0, 71, 178);">184</strong>&gt; còn lại</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Cấu hình: Amaterasu Trấn Mộ + Hoang <strong style="color: rgb(0, 71, 178);">1.35w+</strong> / Hải Nguyệt + Hoang <strong style="color: rgb(0, 71, 178);">1.48w+</strong>; Inaba <strong style="color: rgb(0, 71, 178);">380</strong> CDMG, Fukengaku <strong style="color: rgb(0, 71, 178);">2400</strong> DEF</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Thao tác: P1 Amaterasu dùng chiêu cuối dọn (<strong style="color: rgb(153, 51, 255);">kích Kính Cơ ép máu còn rất thấp</strong> + Izanami giữ mạng); P2-3 Amaterasu dùng chiêu cuối dọn</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Ghi chú: ① <strong style="color: rgb(153, 51, 255);">Không có Amaterasu tốc cao</strong> · Phương án 1 ☞ đổi Inaba sang Enmusubi <strong style="color: rgb(0, 71, 178);">230 tốc</strong>, khóa kỹ năng 2 kéo Amaterasu và cược P1 Kính Cơ ép máu</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú: ① Không có Amaterasu tốc cao ·</span>Phương án 2 ☞ đổi Fukengaku sang Kushi Hỏa Linh <strong style="color: rgb(0, 71, 178);">230 tốc</strong>, khóa kỹ năng 2 kéo Amaterasu và cược P1 Kính Cơ ép máu</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>② Khuyến nghị dùng <strong style="color: rgb(153, 51, 255);">Amaterasu Trấn Mộ + Hoang</strong>; Hải Nguyệt + Hoang dễ bị <strong style="color: rgb(0, 71, 178);">Địa Tạng tạo khiên làm còn máu</strong>; hỗ trợ có điều kiện mang <strong style="color: rgb(153, 51, 255);">bộ 2 Địa Chấn Niêm</strong></p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>③ Dao động thời gian ☞ <strong style="color: rgb(0, 71, 178);">điểm ếch quá nhiều / kích nội tại Ebisu gây kẹt giây</strong></p>'
    ].join('')
  },
  'wiki-editor-bundle-1782887841178-flow-5.json': {
    title: '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><strong>【Sơn Thố đua tốc top 100】Tầng 9</strong></p>',
    team: '【Sơn Thố đua tốc top 100】Tầng 9 · Đội hình',
    detail: [
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Tốc độ: Amaterasu &gt;<strong style="color: rgb(0, 71, 178);">240</strong>&gt; còn lại</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Cấu hình: chỉ số Amaterasu <strong style="color: rgb(0, 71, 178);">1.3w+</strong>, <strong style="color: rgb(153, 51, 255);">ATK cao nhất</strong>; Inaba <strong style="color: rgb(0, 71, 178);">380</strong> CDMG, Fukengaku <strong style="color: rgb(0, 71, 178);">2400</strong> DEF</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Thao tác: P1 Amaterasu dùng chiêu cuối dọn (<strong style="color: rgb(153, 51, 255);">kích Kính Cơ ép máu còn rất thấp</strong> + Izanami giữ mạng); P2-3 Amaterasu dùng chiêu cuối dọn</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Ghi chú: ① <strong style="color: rgb(153, 51, 255);">Không có Amaterasu tốc cao</strong> · Phương án 1 ☞ đổi Inaba sang Enmusubi <strong style="color: rgb(0, 71, 178);">240 tốc</strong>, khóa kỹ năng 2 kéo Amaterasu và cược P1 Kính Cơ ép máu; tốc Amaterasu <strong style="color: rgb(0, 71, 178);">120+</strong></p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú: ① Không có Amaterasu tốc cao ·</span>Phương án 2 ☞ đổi Fukengaku sang Kushi Hỏa Linh <strong style="color: rgb(0, 71, 178);">240 tốc</strong>, khóa kỹ năng 2 kéo Amaterasu và cược P1 Kính Cơ ép máu</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>② Điểm ếch cao có thể làm mất người (<strong style="color: rgb(0, 71, 178);">phụ thuộc RNG</strong>); dao động thời gian đến từ <strong style="color: rgb(0, 71, 178);">điểm ếch / kích nội tại Ebisu gây kẹt giây</strong></p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>③ Nếu điều kiện ngự hồn tốt ☞ <strong style="color: rgb(153, 51, 255);">Amaterasu cũng có thể dùng Trấn Mộ Thú</strong>; nếu không có linh thú Châm Nữ thì tiếp tục dùng linh thú Hỏa Linh</p>'
    ].join('')
  },
  'wiki-editor-bundle-1782887841178-flow-6.json': {
    title: '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><strong>【Sơn Thố đua tốc top 100】Tầng 10</strong></p>',
    team: '【Sơn Thố đua tốc top 100】Tầng 10 · Đội hình',
    detail: [
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Tốc độ: Amaterasu &gt;<strong style="color: rgb(0, 71, 178);">250</strong>&gt; Izanami &gt;<strong style="color: rgb(0, 71, 178);">200</strong>&gt; còn lại</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Cấu hình: chỉ số Amaterasu <strong style="color: rgb(0, 71, 178);">1.28w+</strong>, ATK <strong style="color: rgb(153, 51, 255);">cao nhất ngoài Izanami</strong>; Inaba <strong style="color: rgb(0, 71, 178);">380</strong> CDMG, Fukengaku <strong style="color: rgb(0, 71, 178);">2400</strong> DEF</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Thao tác: P1 Amaterasu dùng chiêu cuối dọn (<strong style="color: rgb(153, 51, 255);">kích Kính Cơ ép máu còn rất thấp</strong> + Izanami giữ mạng); P2 Amaterasu dùng chiêu cuối dọn; P3 <strong style="color: rgb(0, 71, 178);">Amaterasu dùng chiêu cuối, Izanami kết liễu</strong></p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Ghi chú: ① <strong style="color: rgb(153, 51, 255);">Không có Amaterasu tốc cao</strong> · Phương án 1 ☞ đổi Inaba sang Enmusubi <strong style="color: rgb(0, 71, 178);">250 tốc</strong>, khóa kỹ năng 2 kéo Amaterasu và cược P1 Kính Cơ ép máu; tốc Amaterasu <strong style="color: rgb(0, 71, 178);">125+</strong></p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú: ① Không có Amaterasu tốc cao ·</span>Phương án 2 ☞ đổi Fukengaku sang Kushi Hỏa Linh <strong style="color: rgb(0, 71, 178);">250 tốc</strong>, khóa kỹ năng 2 kéo Amaterasu và cược P1 Kính Cơ ép máu</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>② Điểm ếch cao có thể làm mất người (<strong style="color: rgb(0, 71, 178);">phụ thuộc RNG</strong>); dao động thời gian đến từ <strong style="color: rgb(0, 71, 178);">điểm ếch / kích nội tại Ebisu gây kẹt giây</strong></p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(255, 255, 255);">◆ Ghi chú:</span>③ Nếu điều kiện ngự hồn tốt ☞ <strong style="color: rgb(153, 51, 255);">Amaterasu cũng có thể dùng Trấn Mộ Thú</strong></p>'
    ].join('')
  },
  'wiki-editor-bundle-1782887841178-flow-7.json': {
    title: '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><strong>【Sơn Thố đua tốc】Treo máy lấy ngọc</strong></p>',
    team: '【Sơn Thố đua tốc】Treo máy lấy ngọc · Đội hình',
    detail: [
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Tốc độ: Sơn Thố &gt;<strong style="color: rgb(0, 71, 178);">250</strong>&gt; Shuten &gt;<strong style="color: rgb(0, 71, 178);">240</strong>&gt; Seimei (<strong style="color: rgb(0, 71, 178);">128</strong>)&gt; Asura &gt;<strong style="color: rgb(0, 71, 178);">125</strong>&gt; còn lại</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Cấu hình: chỉ số Asura <strong style="color: rgb(0, 71, 178);">2.5w+</strong>, Inaba <strong style="color: rgb(0, 71, 178);">350</strong> CDMG, Fukengaku <strong style="color: rgb(0, 71, 178);">2400</strong> DEF</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Thao tác: có thể treo máy full auto (khóa kỹ năng theo yêu cầu)</p>',
      '<p style="margin:0;text-align:left;font-size:32px;line-height:1.2;"><span style="color: rgb(47, 83, 132);">◆</span> Ghi chú: tốc Sơn Thố <strong style="color: rgb(153, 51, 255);">không được vượt vòng Asura</strong>! (khuyến nghị dùng mã đội hình để tính)</p>'
    ].join('')
  }
}

const termTranslations = {
  '八百比丘尼': 'Bát Bách Bỉ Khâu Ni',
  '预知 Lv5': 'Dự Tri Lv5',
  '星陨 Lv5': 'Tinh Vẫn Lv5',
  '阴阳师': 'Âm Dương Sư',
  '玉藻前': 'Tamamo-no-Mae',
  '破势': 'Phá Thế',
  '破': 'Phá',
  '荒骷髅': 'Hoang Khô Lâu',
  '荒': 'Hoang',
  '座敷童子': 'Toạ Phu Đồng Tử',
  '火灵': 'Hỏa Linh',
  '涂壁': 'Đồ Bích',
  '式神#412': 'Thức thần #412',
  '式神#602': 'Thức thần #602',
  '散件': 'Set lẻ',
  '出世螺': 'Xuất Thế Loa',
  '天照': 'Amaterasu',
  '海月火玉': 'Hải Nguyệt Hỏa Ngọc',
  '海': 'Hải',
  '天火命铃彦姬': 'Thiên Hỏa Mệnh Linh Ngạn Cơ',
  '绘世花鸟卷': 'Hội Thế Hoa Điểu Quyển',
  '鬼王酒吞童子': 'Quỷ Vương Tửu Thôn Đồng Tử',
  '蚌精': 'Bạng Tinh',
  '源赖光': 'Nguyên Lại Quang',
  '天下布武 Lv5': 'Thiên Hạ Bố Võ Lv5',
  '血之契 Lv5': 'Huyết Chi Khế Lv5',
  '神堕八岐大蛇': 'SP Orochi',
  '卑弥呼': 'Himiko',
  '食灵': 'Shokurei',
  '青女房': 'Thanh Nữ Phòng',
  '房': 'Phòng',
  '地震鲶': 'Địa Chấn Niêm',
  '不见岳': 'Fukengaku',
  '镇墓兽': 'Trấn Mộ Thú',
  '镇': 'Trấn',
  '伊邪那美': 'Izanami',
  '地藏像': 'Địa Tạng Tượng',
  '地藏': 'Địa Tạng',
  '因幡辉夜姬': 'Inaba Kaguya',
  '鬼灵歌伎': 'Quỷ Linh Ca Kỹ',
  '歌伎': 'Ca Kỹ',
  '心眼': 'Tâm Nhãn',
  '心': 'Tâm',
  '晴明': 'Seimei',
  '言灵·星 Lv5': 'Ngôn Linh · Tinh Lv5',
  '言灵·灭 Lv5': 'Ngôn Linh · Diệt Lv5',
  '山兔': 'Sơn Thố',
  '阿修罗': 'Asura'
}

const titleNeedles = [
  ['【山兔竞速前百】1~3层', 'title'],
  ['【山兔竞速前百】4~5层', 'title'],
  ['【山兔竞速前百】6层', 'title'],
  ['【山兔竞速前百】7~8层', 'title'],
  ['【山兔竞速前百】9层', 'title'],
  ['【山兔竞速前百】10层', 'title'],
  ['【山兔竞速】挂机混勾', 'title']
]

const detailNeedles = [
  '配速：玉',
  '配速：照&gt;',
  '配速：SP蛇',
  '配速：照&gt;<strong style="color: rgb(0, 71, 178);">230',
  '配速：照&gt;<strong style="color: rgb(0, 71, 178);">240',
  '配速：照&gt;<strong style="color: rgb(0, 71, 178);">250',
  '配速：兔'
]

function translateString(value, fileName) {
  const flowText = flowTextByFile[fileName]
  if (!flowText) return value

  if (value.includes('本期攻略为常规前百')) {
    return sharedSubtitle
  }
  if (value.includes('山兔竞速') && value.includes('·队伍')) {
    return flowText.team
  }
  if (titleNeedles.some(([needle]) => value.includes(needle))) {
    return flowText.title
  }
  if (detailNeedles.some((needle) => value.includes(needle))) {
    return flowText.detail
  }

  let next = value
  for (const [source, translated] of Object.entries(termTranslations).sort((a, b) => b[0].length - a[0].length)) {
    next = next.split(source).join(translated)
  }
  return next
}

function translateValue(value, fileName) {
  if (Array.isArray(value)) {
    return value.map((item) => translateValue(item, fileName))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateValue(item, fileName)]))
  }
  if (typeof value === 'string') {
    return translateString(value, fileName)
  }
  return value
}

fs.mkdirSync(VI_FLOW_ROOT, { recursive: true })

for (let i = 1; i <= 7; i += 1) {
  const fileName = `${SOURCE_PREFIX}${i}.json`
  const sourcePath = path.join(FLOW_ROOT, fileName)
  const targetPath = path.join(VI_FLOW_ROOT, fileName)
  const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
  const translated = translateValue(raw, fileName)
  fs.writeFileSync(targetPath, `${JSON.stringify(translated, null, 2)}\n`, 'utf8')
  console.log(`Generated ${path.relative(process.cwd(), targetPath)}`)
}
