"use strict";

// packages/vscode-extension/src/assets/png-worker.ts
var import_node_worker_threads = require("node:worker_threads");

// node_modules/@uttori/data-tools/node_modules/pako/dist/pako.mjs
var Z_FIXED = 4;
var Z_BINARY = 0;
var Z_TEXT = 1;
var Z_UNKNOWN = 2;
function zero$1(buf) {
  let len = buf.length;
  while (--len >= 0) buf[len] = 0;
}
var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = 286;
var D_CODES = 30;
var BL_CODES = 19;
var HEAP_SIZE$1 = 573;
var MAX_BITS = 15;
var Buf_size = 16;
var MAX_BL_BITS = 7;
var END_BLOCK = 256;
var REP_3_6 = 16;
var REPZ_3_10 = 17;
var REPZ_11_138 = 18;
var extra_lbits = new Uint8Array([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0
]);
var extra_dbits = new Uint8Array([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13
]);
var extra_blbits = new Uint8Array([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  3,
  7
]);
var bl_order = new Uint8Array([
  16,
  17,
  18,
  0,
  8,
  7,
  9,
  6,
  10,
  5,
  11,
  4,
  12,
  3,
  13,
  2,
  14,
  1,
  15
]);
var DIST_CODE_LEN = 512;
var static_ltree = new Array(288 * 2);
zero$1(static_ltree);
var static_dtree = new Array(D_CODES * 2);
zero$1(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
var _length_code = new Array(256);
zero$1(_length_code);
var base_length = new Array(LENGTH_CODES);
zero$1(base_length);
var base_dist = new Array(D_CODES);
zero$1(base_dist);
var StaticTreeDesc = class {
  constructor(static_tree, extra_bits, extra_base, elems, max_length) {
    this.static_tree = static_tree;
    this.extra_bits = extra_bits;
    this.extra_base = extra_base;
    this.elems = elems;
    this.max_length = max_length;
    this.has_stree = static_tree && static_tree.length;
  }
};
var static_l_desc;
var static_d_desc;
var static_bl_desc;
var TreeDesc = class {
  constructor(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree;
    this.max_code = 0;
    this.stat_desc = stat_desc;
  }
};
var d_code = (dist) => {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};
var put_short = (s, w) => {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = w >>> 8 & 255;
};
var send_bits = (s, value, length) => {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= value << s.bi_valid & 65535;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> Buf_size - s.bi_valid;
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= value << s.bi_valid & 65535;
    s.bi_valid += length;
  }
};
var send_code = (s, c, tree) => {
  send_bits(s, tree[c * 2], tree[c * 2 + 1]);
};
var bi_reverse = (code, len) => {
  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};
var bi_flush = (s) => {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 255;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
};
var gen_bitlen = (s, desc) => {
  const tree = desc.dyn_tree;
  const max_code = desc.max_code;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const extra = desc.stat_desc.extra_bits;
  const base = desc.stat_desc.extra_base;
  const max_length = desc.stat_desc.max_length;
  let h;
  let n, m;
  let bits;
  let xbits;
  let f;
  let overflow = 0;
  for (bits = 0; bits <= MAX_BITS; bits++) s.bl_count[bits] = 0;
  tree[s.heap[s.heap_max] * 2 + 1] = 0;
  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1] = bits;
    if (n > max_code) continue;
    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) xbits = extra[n - base];
    f = tree[n * 2];
    s.opt_len += f * (bits + xbits);
    if (has_stree) s.static_len += f * (stree[n * 2 + 1] + xbits);
  }
  if (overflow === 0) return;
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) bits--;
    s.bl_count[bits]--;
    s.bl_count[bits + 1] += 2;
    s.bl_count[max_length]--;
    overflow -= 2;
  } while (overflow > 0);
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) continue;
      if (tree[m * 2 + 1] !== bits) {
        s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
        tree[m * 2 + 1] = bits;
      }
      n--;
    }
  }
};
var gen_codes = (tree, max_code, bl_count) => {
  const next_code = new Array(16);
  let code = 0;
  let bits;
  let n;
  for (bits = 1; bits <= MAX_BITS; bits++) {
    code = code + bl_count[bits - 1] << 1;
    next_code[bits] = code;
  }
  for (n = 0; n <= max_code; n++) {
    let len = tree[n * 2 + 1];
    if (len === 0) continue;
    tree[n * 2] = bi_reverse(next_code[len]++, len);
  }
};
var tr_static_init = () => {
  let n;
  let bits;
  let length;
  let code;
  let dist;
  const bl_count = new Array(16);
  length = 0;
  for (code = 0; code < LENGTH_CODES - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < 1 << extra_lbits[code]; n++) _length_code[length++] = code;
  }
  _length_code[length - 1] = code;
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < 1 << extra_dbits[code]; n++) _dist_code[dist++] = code;
  }
  dist >>= 7;
  for (; code < D_CODES; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < 1 << extra_dbits[code] - 7; n++) _dist_code[256 + dist++] = code;
  }
  for (bits = 0; bits <= MAX_BITS; bits++) bl_count[bits] = 0;
  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  gen_codes(static_ltree, 287, bl_count);
  for (n = 0; n < D_CODES; n++) {
    static_dtree[n * 2 + 1] = 5;
    static_dtree[n * 2] = bi_reverse(n, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, 257, L_CODES, MAX_BITS);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);
};
var init_block = (s) => {
  let n;
  for (n = 0; n < L_CODES; n++) s.dyn_ltree[n * 2] = 0;
  for (n = 0; n < D_CODES; n++) s.dyn_dtree[n * 2] = 0;
  for (n = 0; n < BL_CODES; n++) s.bl_tree[n * 2] = 0;
  s.dyn_ltree[END_BLOCK * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.sym_next = s.matches = 0;
};
var bi_windup = (s) => {
  if (s.bi_valid > 8) put_short(s, s.bi_buf);
  else if (s.bi_valid > 0) s.pending_buf[s.pending++] = s.bi_buf;
  s.bi_buf = 0;
  s.bi_valid = 0;
};
var smaller = (tree, n, m, depth) => {
  const _n2 = n * 2;
  const _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
};
var pqdownheap = (s, tree, k) => {
  const v = s.heap[k];
  let j = k << 1;
  while (j <= s.heap_len) {
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) j++;
    if (smaller(tree, v, s.heap[j], s.depth)) break;
    s.heap[k] = s.heap[j];
    k = j;
    j <<= 1;
  }
  s.heap[k] = v;
};
var compress_block = (s, ltree, dtree) => {
  let dist;
  let lc;
  let sx = 0;
  let code;
  let extra;
  if (s.sym_next !== 0) do {
    dist = s.pending_buf[s.sym_buf + sx++] & 255;
    dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
    lc = s.pending_buf[s.sym_buf + sx++];
    if (dist === 0) send_code(s, lc, ltree);
    else {
      code = _length_code[lc];
      send_code(s, code + LITERALS + 1, ltree);
      extra = extra_lbits[code];
      if (extra !== 0) {
        lc -= base_length[code];
        send_bits(s, lc, extra);
      }
      dist--;
      code = d_code(dist);
      send_code(s, code, dtree);
      extra = extra_dbits[code];
      if (extra !== 0) {
        dist -= base_dist[code];
        send_bits(s, dist, extra);
      }
    }
  } while (sx < s.sym_next);
  send_code(s, END_BLOCK, ltree);
};
var build_tree = (s, desc) => {
  const tree = desc.dyn_tree;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems = desc.stat_desc.elems;
  let n, m;
  let max_code = -1;
  let node;
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;
  for (n = 0; n < elems; n++) if (tree[n * 2] !== 0) {
    s.heap[++s.heap_len] = max_code = n;
    s.depth[n] = 0;
  } else tree[n * 2 + 1] = 0;
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node * 2] = 1;
    s.depth[node] = 0;
    s.opt_len--;
    if (has_stree) s.static_len -= stree[node * 2 + 1];
  }
  desc.max_code = max_code;
  for (n = s.heap_len >> 1; n >= 1; n--) pqdownheap(s, tree, n);
  node = elems;
  do {
    n = s.heap[1];
    s.heap[1] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1);
    m = s.heap[1];
    s.heap[--s.heap_max] = n;
    s.heap[--s.heap_max] = m;
    tree[node * 2] = tree[n * 2] + tree[m * 2];
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] = tree[m * 2 + 1] = node;
    s.heap[1] = node++;
    pqdownheap(s, tree, 1);
  } while (s.heap_len >= 2);
  s.heap[--s.heap_max] = s.heap[1];
  gen_bitlen(s, desc);
  gen_codes(tree, max_code, s.bl_count);
};
var scan_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] = 65535;
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) continue;
    else if (count < min_count) s.bl_tree[curlen * 2] += count;
    else if (curlen !== 0) {
      if (curlen !== prevlen) s.bl_tree[curlen * 2]++;
      s.bl_tree[REP_3_6 * 2]++;
    } else if (count <= 10) s.bl_tree[REPZ_3_10 * 2]++;
    else s.bl_tree[REPZ_11_138 * 2]++;
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var send_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) continue;
    else if (count < min_count) do
      send_code(s, curlen, s.bl_tree);
    while (--count !== 0);
    else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);
    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var build_bl_tree = (s) => {
  let max_blindex;
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree(s, s.bl_desc);
  for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) break;
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
};
var send_all_trees = (s, lcodes, dcodes, blcodes) => {
  let rank2;
  send_bits(s, lcodes - 257, 5);
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4);
  for (rank2 = 0; rank2 < blcodes; rank2++) send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
  send_tree(s, s.dyn_ltree, lcodes - 1);
  send_tree(s, s.dyn_dtree, dcodes - 1);
};
var detect_data_type = (s) => {
  let block_mask = 4093624447;
  let n;
  for (n = 0; n <= 31; n++, block_mask >>>= 1) if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0) return Z_BINARY;
  if (s.dyn_ltree[18] !== 0 || s.dyn_ltree[20] !== 0 || s.dyn_ltree[26] !== 0) return Z_TEXT;
  for (n = 32; n < LITERALS; n++) if (s.dyn_ltree[n * 2] !== 0) return Z_TEXT;
  return Z_BINARY;
};
var static_init_done = false;
var _tr_init = (s) => {
  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }
  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
  s.bi_buf = 0;
  s.bi_valid = 0;
  init_block(s);
};
var _tr_stored_block = (s, buf, stored_len, last) => {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  bi_windup(s);
  put_short(s, stored_len);
  put_short(s, ~stored_len);
  if (stored_len) s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  s.pending += stored_len;
};
var _tr_align = (s) => {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
};
var _tr_flush_block = (s, buf, stored_len, last) => {
  let opt_lenb, static_lenb;
  let max_blindex = 0;
  if (s.level > 0) {
    if (s.strm.data_type === Z_UNKNOWN) s.strm.data_type = detect_data_type(s);
    build_tree(s, s.l_desc);
    build_tree(s, s.d_desc);
    max_blindex = build_bl_tree(s);
    opt_lenb = s.opt_len + 3 + 7 >>> 3;
    static_lenb = s.static_len + 3 + 7 >>> 3;
    if (static_lenb <= opt_lenb || s.strategy === Z_FIXED) opt_lenb = static_lenb;
  } else opt_lenb = static_lenb = stored_len + 5;
  if (stored_len + 4 <= opt_lenb && buf !== -1) _tr_stored_block(s, buf, stored_len, last);
  else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  init_block(s);
  if (last) bi_windup(s);
};
var _tr_tally = (s, dist, lc) => {
  s.pending_buf[s.sym_buf + s.sym_next++] = dist;
  s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
  s.pending_buf[s.sym_buf + s.sym_next++] = lc;
  if (dist === 0) s.dyn_ltree[lc * 2]++;
  else {
    s.matches++;
    dist--;
    s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]++;
    s.dyn_dtree[d_code(dist) * 2]++;
  }
  return s.sym_next === s.sym_end;
};
var adler32 = (adler, buf, len, pos) => {
  let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
  while (len !== 0) {
    n = len > 2e3 ? 2e3 : len;
    len -= n;
    do {
      s1 = s1 + buf[pos++] | 0;
      s2 = s2 + s1 | 0;
    } while (--n);
    s1 %= 65521;
    s2 %= 65521;
  }
  return s1 | s2 << 16 | 0;
};
var makeTable = () => {
  let c, table = [];
  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[n] = c;
  }
  return table;
};
var crcTable = new Uint32Array(makeTable());
var crc32 = (crc, buf, len, pos) => {
  const t = crcTable;
  const end = pos + len;
  crc ^= -1;
  for (let i = pos; i < end; i++) crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
  return crc ^ -1;
};
var messages_default = {
  2: "need dictionary",
  1: "stream end",
  0: "",
  "-1": "file error",
  "-2": "stream error",
  "-3": "data error",
  "-4": "insufficient memory",
  "-5": "buffer error",
  "-6": "incompatible version"
};
var MAX_MEM_LEVEL = 9;
var HEAP_SIZE = 573;
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = 262;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var GZIP_STATE = 57;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
var OS_CODE = 3;
var err = (strm, errorCode) => {
  strm.msg = messages_default[errorCode];
  return errorCode;
};
var rank = (f) => {
  return f * 2 - (f > 4 ? 9 : 0);
};
var zero = (buf) => {
  let len = buf.length;
  while (--len >= 0) buf[len] = 0;
};
var slide_hash = (s) => {
  let n, m;
  let p;
  let wsize = s.w_size;
  n = s.hash_size;
  p = n;
  do {
    m = s.head[--p];
    s.head[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
  n = wsize;
  p = n;
  do {
    m = s.prev[--p];
    s.prev[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
};
var HASH = (s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask;
var INSERT_STRING = (s, str) => {
  let h;
  if (s.legacy_hash) h = s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
  else {
    const w = s.window;
    const value = w[str] | w[str + 1] << 8 | w[str + 2] << 16 | w[str + 3] << 24;
    h = s.ins_h = Math.imul(value, 66521) + 66521 >>> 16 & s.hash_mask;
  }
  const hash_head = s.prev[str & s.w_mask] = s.head[h];
  s.head[h] = str;
  return hash_head;
};
var flush_pending = (strm) => {
  const s = strm.state;
  let len = s.pending;
  if (len > strm.avail_out) len = strm.avail_out;
  if (len === 0) return;
  strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) s.pending_out = 0;
};
var flush_block_only = (s, last) => {
  _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
};
var put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};
var putShortMSB = (s, b) => {
  s.pending_buf[s.pending++] = b >>> 8 & 255;
  s.pending_buf[s.pending++] = b & 255;
};
var read_buf = (strm, buf, start, size) => {
  let len = strm.avail_in;
  if (len > size) len = size;
  if (len === 0) return 0;
  strm.avail_in -= len;
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1) strm.adler = adler32(strm.adler, buf, len, start);
  else if (strm.state.wrap === 2) strm.adler = crc32(strm.adler, buf, len, start);
  strm.next_in += len;
  strm.total_in += len;
  return len;
};
var longest_match = (s, cur_match) => {
  let chain_length = s.max_chain_length;
  let scan = s.strstart;
  let match;
  let len;
  let best_len = s.prev_length;
  let nice_match = s.nice_match;
  const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
  const _win = s.window;
  const wmask = s.w_mask;
  const prev = s.prev;
  const strend = s.strstart + MAX_MATCH;
  let scan_end1 = _win[scan + best_len - 1];
  let scan_end = _win[scan + best_len];
  if (s.prev_length >= s.good_match) chain_length >>= 2;
  if (nice_match > s.lookahead) nice_match = s.lookahead;
  do {
    match = cur_match;
    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) continue;
    scan += 2;
    match++;
    do
      ;
    while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;
    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) break;
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  if (best_len <= s.lookahead) return best_len;
  return s.lookahead;
};
var fill_window = (s) => {
  const _w_size = s.w_size;
  let n, more, str;
  do {
    more = s.window_size - s.lookahead - s.strstart;
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      s.block_start -= _w_size;
      if (s.insert > s.strstart) s.insert = s.strstart;
      slide_hash(s);
      more += _w_size;
    }
    if (s.strm.avail_in === 0) break;
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;
    if (!s.legacy_hash) {
      if (s.lookahead + s.insert > MIN_MATCH) {
        str = s.strstart - s.insert;
        while (s.insert) {
          INSERT_STRING(s, str);
          str++;
          s.insert--;
          if (s.lookahead + s.insert <= MIN_MATCH) break;
        }
      }
    } else if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];
      s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
      while (s.insert) {
        INSERT_STRING(s, str);
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) break;
      }
    }
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
};
var deflate_stored = (s, flush) => {
  let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;
  let len, left, have, last = 0;
  let used = s.strm.avail_in;
  do {
    len = 65535;
    have = s.bi_valid + 42 >> 3;
    if (s.strm.avail_out < have) break;
    have = s.strm.avail_out - have;
    left = s.strstart - s.block_start;
    if (len > left + s.strm.avail_in) len = left + s.strm.avail_in;
    if (len > have) len = have;
    if (len < min_block && (len === 0 && flush !== 4 || flush === 0 || len !== left + s.strm.avail_in)) break;
    last = flush === 4 && len === left + s.strm.avail_in ? 1 : 0;
    _tr_stored_block(s, 0, 0, last);
    s.pending_buf[s.pending - 4] = len;
    s.pending_buf[s.pending - 3] = len >> 8;
    s.pending_buf[s.pending - 2] = ~len;
    s.pending_buf[s.pending - 1] = ~len >> 8;
    flush_pending(s.strm);
    if (left) {
      if (left > len) left = len;
      s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
      s.strm.next_out += left;
      s.strm.avail_out -= left;
      s.strm.total_out += left;
      s.block_start += left;
      len -= left;
    }
    if (len) {
      read_buf(s.strm, s.strm.output, s.strm.next_out, len);
      s.strm.next_out += len;
      s.strm.avail_out -= len;
      s.strm.total_out += len;
    }
  } while (last === 0);
  used -= s.strm.avail_in;
  if (used) {
    if (used >= s.w_size) {
      s.matches = 2;
      s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
      s.strstart = s.w_size;
      s.insert = s.strstart;
    } else {
      if (s.window_size - s.strstart <= used) {
        s.strstart -= s.w_size;
        s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
        if (s.matches < 2) s.matches++;
        if (s.insert > s.strstart) s.insert = s.strstart;
      }
      s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
      s.strstart += used;
      s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
    }
    s.block_start = s.strstart;
  }
  if (s.high_water < s.strstart) s.high_water = s.strstart;
  if (last) return BS_FINISH_DONE;
  if (flush !== 0 && flush !== 4 && s.strm.avail_in === 0 && s.strstart === s.block_start) return BS_BLOCK_DONE;
  have = s.window_size - s.strstart;
  if (s.strm.avail_in > have && s.block_start >= s.w_size) {
    s.block_start -= s.w_size;
    s.strstart -= s.w_size;
    s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
    if (s.matches < 2) s.matches++;
    have += s.w_size;
    if (s.insert > s.strstart) s.insert = s.strstart;
  }
  if (have > s.strm.avail_in) have = s.strm.avail_in;
  if (have) {
    read_buf(s.strm, s.window, s.strstart, have);
    s.strstart += have;
    s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
  }
  if (s.high_water < s.strstart) s.high_water = s.strstart;
  have = s.bi_valid + 42 >> 3;
  have = s.pending_buf_size - have > 65535 ? 65535 : s.pending_buf_size - have;
  min_block = have > s.w_size ? s.w_size : have;
  left = s.strstart - s.block_start;
  if (left >= min_block || (left || flush === 4) && flush !== 0 && s.strm.avail_in === 0 && left <= have) {
    len = left > have ? have : left;
    last = flush === 4 && s.strm.avail_in === 0 && len === left ? 1 : 0;
    _tr_stored_block(s, s.block_start, len, last);
    s.block_start += len;
    flush_pending(s.strm);
  }
  return last ? BS_FINISH_STARTED : BS_NEED_MORE;
};
var deflate_fast = (s, flush) => {
  let hash_head;
  let bflush;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === 0) return BS_NEED_MORE;
      if (s.lookahead === 0) break;
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) hash_head = INSERT_STRING(s, s.strstart);
    if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) s.match_length = longest_match(s, hash_head);
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
        s.match_length--;
        do {
          s.strstart++;
          hash_head = INSERT_STRING(s, s.strstart);
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        if (s.legacy_hash) {
          s.ins_h = s.window[s.strstart];
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
        }
      }
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) return BS_NEED_MORE;
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === 4) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) return BS_NEED_MORE;
  }
  return BS_BLOCK_DONE;
};
var deflate_slow = (s, flush) => {
  let hash_head;
  let bflush;
  let max_insert;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === 0) return BS_NEED_MORE;
      if (s.lookahead === 0) break;
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) hash_head = INSERT_STRING(s, s.strstart);
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;
    if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
      if (s.match_length <= 5 && (s.strategy === 1 || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) s.match_length = MIN_MATCH - 1;
    }
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do
        if (++s.strstart <= max_insert) hash_head = INSERT_STRING(s, s.strstart);
      while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) return BS_NEED_MORE;
      }
    } else if (s.match_available) {
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
      if (bflush)
        flush_block_only(s, false);
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) return BS_NEED_MORE;
    } else {
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  if (s.match_available) {
    bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === 4) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) return BS_NEED_MORE;
  }
  return BS_BLOCK_DONE;
};
var deflate_rle = (s, flush) => {
  let bflush;
  let prev;
  let scan, strend;
  const _win = s.window;
  for (; ; ) {
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === 0) return BS_NEED_MORE;
      if (s.lookahead === 0) break;
    }
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do
          ;
        while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) s.match_length = s.lookahead;
      }
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) return BS_NEED_MORE;
    }
  }
  s.insert = 0;
  if (flush === 4) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) return BS_NEED_MORE;
  }
  return BS_BLOCK_DONE;
};
var deflate_huff = (s, flush) => {
  let bflush;
  for (; ; ) {
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === 0) return BS_NEED_MORE;
        break;
      }
    }
    s.match_length = 0;
    bflush = _tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) return BS_NEED_MORE;
    }
  }
  s.insert = 0;
  if (flush === 4) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) return BS_NEED_MORE;
  }
  return BS_BLOCK_DONE;
};
var Config = class {
  constructor(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }
};
var configuration_table = [
  new Config(0, 0, 0, 0, deflate_stored),
  new Config(4, 4, 8, 4, deflate_fast),
  new Config(4, 5, 16, 8, deflate_fast),
  new Config(4, 6, 32, 32, deflate_fast),
  new Config(4, 4, 16, 16, deflate_slow),
  new Config(8, 16, 32, 32, deflate_slow),
  new Config(8, 16, 128, 128, deflate_slow),
  new Config(8, 32, 128, 256, deflate_slow),
  new Config(32, 128, 258, 1024, deflate_slow),
  new Config(32, 258, 258, 4096, deflate_slow)
];
var lm_init = (s) => {
  s.window_size = 2 * s.w_size;
  zero(s.head);
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;
  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
};
var DeflateState = class {
  constructor() {
    this.strm = null;
    this.status = 0;
    this.pending_buf = null;
    this.pending_buf_size = 0;
    this.pending_out = 0;
    this.pending = 0;
    this.wrap = 0;
    this.gzhead = null;
    this.gzindex = 0;
    this.method = 8;
    this.last_flush = -1;
    this.w_size = 0;
    this.w_bits = 0;
    this.w_mask = 0;
    this.window = null;
    this.window_size = 0;
    this.prev = null;
    this.head = null;
    this.ins_h = 0;
    this.legacy_hash = 0;
    this.hash_size = 0;
    this.hash_bits = 0;
    this.hash_mask = 0;
    this.hash_shift = 0;
    this.block_start = 0;
    this.match_length = 0;
    this.prev_match = 0;
    this.match_available = 0;
    this.strstart = 0;
    this.match_start = 0;
    this.lookahead = 0;
    this.prev_length = 0;
    this.max_chain_length = 0;
    this.max_lazy_match = 0;
    this.level = 0;
    this.strategy = 0;
    this.good_match = 0;
    this.nice_match = 0;
    this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
    this.dyn_dtree = /* @__PURE__ */ new Uint16Array(122);
    this.bl_tree = /* @__PURE__ */ new Uint16Array(78);
    zero(this.dyn_ltree);
    zero(this.dyn_dtree);
    zero(this.bl_tree);
    this.l_desc = null;
    this.d_desc = null;
    this.bl_desc = null;
    this.bl_count = /* @__PURE__ */ new Uint16Array(16);
    this.heap = /* @__PURE__ */ new Uint16Array(573);
    zero(this.heap);
    this.heap_len = 0;
    this.heap_max = 0;
    this.depth = /* @__PURE__ */ new Uint16Array(573);
    zero(this.depth);
    this.sym_buf = 0;
    this.lit_bufsize = 0;
    this.sym_next = 0;
    this.sym_end = 0;
    this.opt_len = 0;
    this.static_len = 0;
    this.matches = 0;
    this.insert = 0;
    this.bi_buf = 0;
    this.bi_valid = 0;
  }
};
var deflateStateCheck = (strm) => {
  if (!strm) return 1;
  const s = strm.state;
  if (!s || s.strm !== strm || s.status !== INIT_STATE && s.status !== GZIP_STATE && s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE) return 1;
  return 0;
};
var deflateResetKeep = (strm) => {
  if (deflateStateCheck(strm)) return err(strm, -2);
  strm.total_in = strm.total_out = 0;
  strm.data_type = 2;
  const s = strm.state;
  s.pending = 0;
  s.pending_out = 0;
  if (s.wrap < 0) s.wrap = -s.wrap;
  s.status = s.wrap === 2 ? GZIP_STATE : s.wrap ? INIT_STATE : BUSY_STATE;
  strm.adler = s.wrap === 2 ? 0 : 1;
  s.last_flush = -2;
  _tr_init(s);
  return 0;
};
var deflateReset = (strm) => {
  const ret = deflateResetKeep(strm);
  if (ret === 0) lm_init(strm.state);
  return ret;
};
var deflateInit2 = (strm, level, method, windowBits, memLevel, strategy, legacyHash) => {
  if (!strm) return -2;
  let wrap = 1;
  if (level === -1) level = 6;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2;
    windowBits -= 16;
  }
  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== 8 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > 4 || windowBits === 8 && wrap !== 1) return err(strm, -2);
  if (windowBits === 8) windowBits = 9;
  const s = new DeflateState();
  strm.state = s;
  s.strm = strm;
  s.status = INIT_STATE;
  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;
  s.legacy_hash = legacyHash ? 1 : 0;
  s.hash_bits = memLevel + 7;
  if (!s.legacy_hash && s.hash_bits < 15) s.hash_bits = 15;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
  s.window = new Uint8Array(s.w_size * 2);
  s.head = new Uint16Array(s.hash_size);
  s.prev = new Uint16Array(s.w_size);
  s.lit_bufsize = 1 << memLevel + 6;
  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new Uint8Array(s.pending_buf_size);
  s.sym_buf = s.lit_bufsize;
  s.sym_end = (s.lit_bufsize - 1) * 3;
  s.level = level;
  s.strategy = strategy;
  s.method = method;
  return deflateReset(strm);
};
var deflate$1 = (strm, flush) => {
  if (deflateStateCheck(strm) || flush > 5 || flush < 0) return strm ? err(strm, -2) : -2;
  const s = strm.state;
  if (!strm.output || strm.avail_in !== 0 && !strm.input || s.status === FINISH_STATE && flush !== 4) return err(strm, strm.avail_out === 0 ? -5 : -2);
  const old_flush = s.last_flush;
  s.last_flush = flush;
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      s.last_flush = -1;
      return 0;
    }
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== 4) return err(strm, -5);
  if (s.status === FINISH_STATE && strm.avail_in !== 0) return err(strm, -5);
  if (s.status === INIT_STATE && s.wrap === 0) s.status = BUSY_STATE;
  if (s.status === INIT_STATE) {
    let header = 8 + (s.w_bits - 8 << 4) << 8;
    let level_flags = -1;
    if (s.strategy >= 2 || s.level < 2) level_flags = 0;
    else if (s.level < 6) level_flags = 1;
    else if (s.level === 6) level_flags = 2;
    else level_flags = 3;
    header |= level_flags << 6;
    if (s.strstart !== 0) header |= PRESET_DICT;
    header += 31 - header % 31;
    putShortMSB(s, header);
    if (s.strstart !== 0) {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    strm.adler = 1;
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return 0;
    }
  }
  if (s.status === GZIP_STATE) {
    strm.adler = 0;
    put_byte(s, 31);
    put_byte(s, 139);
    put_byte(s, 8);
    if (!s.gzhead) {
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= 2 || s.level < 2 ? 4 : 0);
      put_byte(s, OS_CODE);
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return 0;
      }
    } else {
      put_byte(s, (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16));
      put_byte(s, s.gzhead.time & 255);
      put_byte(s, s.gzhead.time >> 8 & 255);
      put_byte(s, s.gzhead.time >> 16 & 255);
      put_byte(s, s.gzhead.time >> 24 & 255);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= 2 || s.level < 2 ? 4 : 0);
      put_byte(s, s.gzhead.os & 255);
      if (s.gzhead.extra && s.gzhead.extra.length) {
        put_byte(s, s.gzhead.extra.length & 255);
        put_byte(s, s.gzhead.extra.length >> 8 & 255);
      }
      if (s.gzhead.hcrc) strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
      s.gzindex = 0;
      s.status = EXTRA_STATE;
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra) {
      let beg = s.pending;
      let left = (s.gzhead.extra.length & 65535) - s.gzindex;
      while (s.pending + left > s.pending_buf_size) {
        let copy = s.pending_buf_size - s.pending;
        s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
        s.pending = s.pending_buf_size;
        if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        s.gzindex += copy;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return 0;
        }
        beg = 0;
        left -= copy;
      }
      let gzhead_extra = new Uint8Array(s.gzhead.extra);
      s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
      s.pending += left;
      if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      s.gzindex = 0;
    }
    s.status = NAME_STATE;
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return 0;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.name.length) val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
        else val = 0;
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      s.gzindex = 0;
    }
    s.status = COMMENT_STATE;
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return 0;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.comment.length) val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
        else val = 0;
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
    }
    s.status = HCRC_STATE;
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return 0;
        }
      }
      put_byte(s, strm.adler & 255);
      put_byte(s, strm.adler >> 8 & 255);
      strm.adler = 0;
    }
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return 0;
    }
  }
  if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== 0 && s.status !== FINISH_STATE) {
    let bstate = s.level === 0 ? deflate_stored(s, flush) : s.strategy === 2 ? deflate_huff(s, flush) : s.strategy === 3 ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) s.status = FINISH_STATE;
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) s.last_flush = -1;
      return 0;
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === 1) _tr_align(s);
      else if (flush !== 5) {
        _tr_stored_block(s, 0, 0, false);
        if (flush === 3) {
          zero(s.head);
          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return 0;
      }
    }
  }
  if (flush !== 4) return 0;
  if (s.wrap <= 0) return 1;
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 255);
    put_byte(s, strm.adler >> 8 & 255);
    put_byte(s, strm.adler >> 16 & 255);
    put_byte(s, strm.adler >> 24 & 255);
    put_byte(s, strm.total_in & 255);
    put_byte(s, strm.total_in >> 8 & 255);
    put_byte(s, strm.total_in >> 16 & 255);
    put_byte(s, strm.total_in >> 24 & 255);
  } else {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 65535);
  }
  flush_pending(strm);
  if (s.wrap > 0) s.wrap = -s.wrap;
  return s.pending !== 0 ? 0 : 1;
};
var deflateEnd = (strm) => {
  if (deflateStateCheck(strm)) return -2;
  const status = strm.state.status;
  strm.state = null;
  return status === BUSY_STATE ? err(strm, -3) : 0;
};
var deflateSetDictionary = (strm, dictionary) => {
  let dictLength = dictionary.length;
  if (deflateStateCheck(strm)) return -2;
  const s = strm.state;
  const wrap = s.wrap;
  if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) return -2;
  if (wrap === 1) strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
  s.wrap = 0;
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      zero(s.head);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    let tmpDict = new Uint8Array(s.w_size);
    tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  const avail = strm.avail_in;
  const next = strm.next_in;
  const input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    let str = s.strstart;
    let n = s.lookahead - (MIN_MATCH - 1);
    do {
      INSERT_STRING(s, str);
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return 0;
};
var BAD$1 = 16209;
var TYPE$1 = 16191;
function inflate_fast(strm, start) {
  let _in;
  let last;
  let _out;
  let beg;
  let end;
  let dmax;
  let wsize;
  let whave;
  let wnext;
  let s_window;
  let hold;
  let bits;
  let lcode;
  let dcode;
  let lmask;
  let dmask;
  let here;
  let op;
  let len;
  let dist;
  let from;
  let from_source;
  let input, output;
  const state = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state.dmax;
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;
  top: do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }
    here = lcode[hold & lmask];
    dolen: for (; ; ) {
      op = here >>> 24;
      hold >>>= op;
      bits -= op;
      op = here >>> 16 & 255;
      if (op === 0) output[_out++] = here & 65535;
      else if (op & 16) {
        len = here & 65535;
        op &= 15;
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & (1 << op) - 1;
          hold >>>= op;
          bits -= op;
        }
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];
        dodist: for (; ; ) {
          op = here >>> 24;
          hold >>>= op;
          bits -= op;
          op = here >>> 16 & 255;
          if (op & 16) {
            dist = here & 65535;
            op &= 15;
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & (1 << op) - 1;
            if (dist > dmax) {
              strm.msg = "invalid distance too far back";
              state.mode = BAD$1;
              break top;
            }
            hold >>>= op;
            bits -= op;
            op = _out - beg;
            if (dist > op) {
              op = dist - op;
              if (op > whave) {
                if (state.sane) {
                  strm.msg = "invalid distance too far back";
                  state.mode = BAD$1;
                  break top;
                }
              }
              from = 0;
              from_source = s_window;
              if (wnext === 0) {
                from += wsize - op;
                if (op < len) {
                  len -= op;
                  do
                    output[_out++] = s_window[from++];
                  while (--op);
                  from = _out - dist;
                  from_source = output;
                }
              } else if (wnext < op) {
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {
                  len -= op;
                  do
                    output[_out++] = s_window[from++];
                  while (--op);
                  from = 0;
                  if (wnext < len) {
                    op = wnext;
                    len -= op;
                    do
                      output[_out++] = s_window[from++];
                    while (--op);
                    from = _out - dist;
                    from_source = output;
                  }
                }
              } else {
                from += wnext - op;
                if (op < len) {
                  len -= op;
                  do
                    output[_out++] = s_window[from++];
                  while (--op);
                  from = _out - dist;
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) output[_out++] = from_source[from++];
              }
            } else {
              from = _out - dist;
              do {
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) output[_out++] = output[from++];
              }
            }
          } else if ((op & 64) === 0) {
            here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
            continue dodist;
          } else {
            strm.msg = "invalid distance code";
            state.mode = BAD$1;
            break top;
          }
          break;
        }
      } else if ((op & 64) === 0) {
        here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
        continue dolen;
      } else if (op & 32) {
        state.mode = TYPE$1;
        break top;
      } else {
        strm.msg = "invalid literal/length code";
        state.mode = BAD$1;
        break top;
      }
      break;
    }
  } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
}
var MAXBITS = 15;
var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;
var lbase = new Uint16Array([
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
]);
var lext = new Uint8Array([
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  16,
  199,
  75
]);
var dbase = new Uint16Array([
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
  0,
  0
]);
var dext = new Uint8Array([
  16,
  16,
  16,
  16,
  17,
  17,
  18,
  18,
  19,
  19,
  20,
  20,
  21,
  21,
  22,
  22,
  23,
  23,
  24,
  24,
  25,
  25,
  26,
  26,
  27,
  27,
  28,
  28,
  29,
  29,
  64,
  64
]);
var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
  const bits = opts.bits;
  let len = 0;
  let sym = 0;
  let min = 0, max = 0;
  let root = 0;
  let curr = 0;
  let drop = 0;
  let left = 0;
  let used = 0;
  let huff = 0;
  let incr;
  let fill;
  let low;
  let mask;
  let next;
  let base = null;
  let match;
  const count = /* @__PURE__ */ new Uint16Array(16);
  const offs = /* @__PURE__ */ new Uint16Array(16);
  let extra = null;
  let here_bits, here_op, here_val;
  for (len = 0; len <= MAXBITS; len++) count[len] = 0;
  for (sym = 0; sym < codes; sym++) count[lens[lens_index + sym]]++;
  root = bits;
  for (max = MAXBITS; max >= 1; max--) if (count[max] !== 0) break;
  if (root > max) root = max;
  if (max === 0) {
    table[table_index++] = 20971520;
    table[table_index++] = 20971520;
    opts.bits = 1;
    return 0;
  }
  for (min = 1; min < max; min++) if (count[min] !== 0) break;
  if (root < min) root = min;
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) return -1;
  }
  if (left > 0 && (type === CODES$1 || max !== 1)) return -1;
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) offs[len + 1] = offs[len] + count[len];
  for (sym = 0; sym < codes; sym++) if (lens[lens_index + sym] !== 0) work[offs[lens[lens_index + sym]]++] = sym;
  if (type === CODES$1) {
    base = extra = work;
    match = 20;
  } else if (type === LENS$1) {
    base = lbase;
    extra = lext;
    match = 257;
  } else {
    base = dbase;
    extra = dext;
    match = 0;
  }
  huff = 0;
  sym = 0;
  len = min;
  next = table_index;
  curr = root;
  drop = 0;
  low = -1;
  used = 1 << root;
  mask = used - 1;
  if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) return 1;
  for (; ; ) {
    here_bits = len - drop;
    if (work[sym] + 1 < match) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] >= match) {
      here_op = extra[work[sym] - match];
      here_val = base[work[sym] - match];
    } else {
      here_op = 96;
      here_val = 0;
    }
    incr = 1 << len - drop;
    fill = 1 << curr;
    min = fill;
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
    } while (fill !== 0);
    incr = 1 << len - 1;
    while (huff & incr) incr >>= 1;
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else huff = 0;
    sym++;
    if (--count[len] === 0) {
      if (len === max) break;
      len = lens[lens_index + work[sym]];
    }
    if (len > root && (huff & mask) !== low) {
      if (drop === 0) drop = root;
      next += min;
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) break;
        curr++;
        left <<= 1;
      }
      used += 1 << curr;
      if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) return 1;
      low = huff & mask;
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }
  if (huff !== 0) table[next + huff] = len - drop << 24 | 4194304;
  opts.bits = root;
  return 0;
};
var CODES = 0;
var LENS = 1;
var DISTS = 2;
var HEAD = 16180;
var FLAGS = 16181;
var TIME = 16182;
var OS = 16183;
var EXLEN = 16184;
var EXTRA = 16185;
var NAME = 16186;
var COMMENT = 16187;
var HCRC = 16188;
var DICTID = 16189;
var DICT = 16190;
var TYPE = 16191;
var TYPEDO = 16192;
var STORED = 16193;
var COPY_ = 16194;
var COPY = 16195;
var TABLE = 16196;
var LENLENS = 16197;
var CODELENS = 16198;
var LEN_ = 16199;
var LEN = 16200;
var LENEXT = 16201;
var DIST = 16202;
var DISTEXT = 16203;
var MATCH = 16204;
var LIT = 16205;
var CHECK = 16206;
var LENGTH = 16207;
var DONE = 16208;
var BAD = 16209;
var MEM = 16210;
var SYNC = 16211;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
var zswap32 = (q) => {
  return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
};
var InflateState = class {
  constructor() {
    this.strm = null;
    this.mode = 0;
    this.last = false;
    this.wrap = 0;
    this.havedict = false;
    this.flags = 0;
    this.dmax = 0;
    this.check = 0;
    this.total = 0;
    this.head = null;
    this.wbits = 0;
    this.wsize = 0;
    this.whave = 0;
    this.wnext = 0;
    this.window = null;
    this.hold = 0;
    this.bits = 0;
    this.length = 0;
    this.offset = 0;
    this.extra = 0;
    this.lencode = null;
    this.distcode = null;
    this.lenbits = 0;
    this.distbits = 0;
    this.ncode = 0;
    this.nlen = 0;
    this.ndist = 0;
    this.have = 0;
    this.next = null;
    this.lens = /* @__PURE__ */ new Uint16Array(320);
    this.work = /* @__PURE__ */ new Uint16Array(288);
    this.lendyn = null;
    this.distdyn = null;
    this.sane = 0;
    this.back = 0;
    this.was = 0;
  }
};
var inflateStateCheck = (strm) => {
  if (!strm) return 1;
  const state = strm.state;
  if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) return 1;
  return 0;
};
var inflateResetKeep = (strm) => {
  if (inflateStateCheck(strm)) return -2;
  const state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = "";
  if (state.wrap) strm.adler = state.wrap & 1;
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.flags = -1;
  state.dmax = 32768;
  state.head = null;
  state.hold = 0;
  state.bits = 0;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
  state.sane = 1;
  state.back = -1;
  return 0;
};
var inflateReset = (strm) => {
  if (inflateStateCheck(strm)) return -2;
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
};
var inflateReset2 = (strm, windowBits) => {
  let wrap;
  if (inflateStateCheck(strm)) return -2;
  const state = strm.state;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 5;
    if (windowBits < 48) windowBits &= 15;
  }
  if (windowBits && (windowBits < 8 || windowBits > 15)) return -2;
  if (state.window !== null && state.wbits !== windowBits) state.window = null;
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
};
var inflateInit2 = (strm, windowBits) => {
  if (!strm) return -2;
  const state = new InflateState();
  strm.state = state;
  state.strm = strm;
  state.window = null;
  state.mode = HEAD;
  const ret = inflateReset2(strm, windowBits);
  if (ret !== 0) strm.state = null;
  return ret;
};
var virgin = true;
var lenfix;
var distfix;
var fixedtables = (state) => {
  if (virgin) {
    lenfix = /* @__PURE__ */ new Int32Array(512);
    distfix = /* @__PURE__ */ new Int32Array(32);
    let sym = 0;
    while (sym < 144) state.lens[sym++] = 8;
    while (sym < 256) state.lens[sym++] = 9;
    while (sym < 280) state.lens[sym++] = 7;
    while (sym < 288) state.lens[sym++] = 8;
    inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
    sym = 0;
    while (sym < 32) state.lens[sym++] = 5;
    inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
    virgin = false;
  }
  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
};
var updatewindow = (strm, src, end, copy) => {
  let dist;
  const state = strm.state;
  if (state.window === null) state.window = new Uint8Array(1 << state.wbits);
  if (state.wsize === 0) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;
  }
  if (copy >= state.wsize) {
    state.window.set(src.subarray(end - state.wsize, end), 0);
    state.wnext = 0;
    state.whave = state.wsize;
  } else {
    dist = state.wsize - state.wnext;
    if (dist > copy) dist = copy;
    state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
    copy -= dist;
    if (copy) {
      state.window.set(src.subarray(end - copy, end), 0);
      state.wnext = copy;
      state.whave = state.wsize;
    } else {
      state.wnext += dist;
      if (state.wnext === state.wsize) state.wnext = 0;
      if (state.whave < state.wsize) state.whave += dist;
    }
  }
  return 0;
};
var inflate$1 = (strm, flush) => {
  let state;
  let input, output;
  let next;
  let put;
  let have, left;
  let hold;
  let bits;
  let _in, _out;
  let copy;
  let from;
  let from_source;
  let here = 0;
  let here_bits, here_op, here_val;
  let last_bits, last_op, last_val;
  let len;
  let ret;
  const hbuf = /* @__PURE__ */ new Uint8Array(4);
  let opts;
  let n;
  const order = new Uint8Array([
    16,
    17,
    18,
    0,
    8,
    7,
    9,
    6,
    10,
    5,
    11,
    4,
    12,
    3,
    13,
    2,
    14,
    1,
    15
  ]);
  if (inflateStateCheck(strm) || !strm.output || !strm.input && strm.avail_in !== 0) return -2;
  state = strm.state;
  if (state.mode === TYPE) state.mode = TYPEDO;
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  _in = have;
  _out = left;
  ret = 0;
  inf_leave: for (; ; ) switch (state.mode) {
    case HEAD:
      if (state.wrap === 0) {
        state.mode = TYPEDO;
        break;
      }
      while (bits < 16) {
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      if (state.wrap & 2 && hold === 35615) {
        if (state.wbits === 0) state.wbits = 15;
        state.check = 0;
        hbuf[0] = hold & 255;
        hbuf[1] = hold >>> 8 & 255;
        state.check = crc32(state.check, hbuf, 2, 0);
        hold = 0;
        bits = 0;
        state.mode = FLAGS;
        break;
      }
      if (state.head) state.head.done = false;
      if (!(state.wrap & 1) || (((hold & 255) << 8) + (hold >> 8)) % 31) {
        strm.msg = "incorrect header check";
        state.mode = BAD;
        break;
      }
      if ((hold & 15) !== 8) {
        strm.msg = "unknown compression method";
        state.mode = BAD;
        break;
      }
      hold >>>= 4;
      bits -= 4;
      len = (hold & 15) + 8;
      if (state.wbits === 0) state.wbits = len;
      if (len > 15 || len > state.wbits) {
        strm.msg = "invalid window size";
        state.mode = BAD;
        break;
      }
      state.dmax = 1 << state.wbits;
      state.flags = 0;
      strm.adler = state.check = 1;
      state.mode = hold & 512 ? DICTID : TYPE;
      hold = 0;
      bits = 0;
      break;
    case FLAGS:
      while (bits < 16) {
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      state.flags = hold;
      if ((state.flags & 255) !== 8) {
        strm.msg = "unknown compression method";
        state.mode = BAD;
        break;
      }
      if (state.flags & 57344) {
        strm.msg = "unknown header flags set";
        state.mode = BAD;
        break;
      }
      if (state.head) state.head.text = hold >> 8 & 1;
      if (state.flags & 512 && state.wrap & 4) {
        hbuf[0] = hold & 255;
        hbuf[1] = hold >>> 8 & 255;
        state.check = crc32(state.check, hbuf, 2, 0);
      }
      hold = 0;
      bits = 0;
      state.mode = TIME;
    case TIME:
      while (bits < 32) {
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      if (state.head) state.head.time = hold >>> 0;
      if (state.flags & 512 && state.wrap & 4) {
        hbuf[0] = hold & 255;
        hbuf[1] = hold >>> 8 & 255;
        hbuf[2] = hold >>> 16 & 255;
        hbuf[3] = hold >>> 24 & 255;
        state.check = crc32(state.check, hbuf, 4, 0);
      }
      hold = 0;
      bits = 0;
      state.mode = OS;
    case OS:
      while (bits < 16) {
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      if (state.head) {
        state.head.xflags = hold & 255;
        state.head.os = hold >> 8;
      }
      if (state.flags & 512 && state.wrap & 4) {
        hbuf[0] = hold & 255;
        hbuf[1] = hold >>> 8 & 255;
        state.check = crc32(state.check, hbuf, 2, 0);
      }
      hold = 0;
      bits = 0;
      state.mode = EXLEN;
    case EXLEN:
      if (state.flags & 1024) {
        while (bits < 16) {
          if (have === 0) break inf_leave;
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.length = hold;
        if (state.head) state.head.extra_len = hold;
        if (state.flags & 512 && state.wrap & 4) {
          hbuf[0] = hold & 255;
          hbuf[1] = hold >>> 8 & 255;
          state.check = crc32(state.check, hbuf, 2, 0);
        }
        hold = 0;
        bits = 0;
      } else if (state.head) state.head.extra = null;
      state.mode = EXTRA;
    case EXTRA:
      if (state.flags & 1024) {
        copy = state.length;
        if (copy > have) copy = have;
        if (copy) {
          if (state.head) {
            len = state.head.extra_len - state.length;
            if (!state.head.extra) state.head.extra = new Uint8Array(state.head.extra_len);
            state.head.extra.set(input.subarray(next, next + copy), len);
          }
          if (state.flags & 512 && state.wrap & 4) state.check = crc32(state.check, input, copy, next);
          have -= copy;
          next += copy;
          state.length -= copy;
        }
        if (state.length) break inf_leave;
      }
      state.length = 0;
      state.mode = NAME;
    case NAME:
      if (state.flags & 2048) {
        if (have === 0) break inf_leave;
        copy = 0;
        do {
          len = input[next + copy++];
          if (state.head && len && state.length < 65536) state.head.name += String.fromCharCode(len);
        } while (len && copy < have);
        if (state.flags & 512 && state.wrap & 4) state.check = crc32(state.check, input, copy, next);
        have -= copy;
        next += copy;
        if (len) break inf_leave;
      } else if (state.head) state.head.name = null;
      state.length = 0;
      state.mode = COMMENT;
    case COMMENT:
      if (state.flags & 4096) {
        if (have === 0) break inf_leave;
        copy = 0;
        do {
          len = input[next + copy++];
          if (state.head && len && state.length < 65536) state.head.comment += String.fromCharCode(len);
        } while (len && copy < have);
        if (state.flags & 512 && state.wrap & 4) state.check = crc32(state.check, input, copy, next);
        have -= copy;
        next += copy;
        if (len) break inf_leave;
      } else if (state.head) state.head.comment = null;
      state.mode = HCRC;
    case HCRC:
      if (state.flags & 512) {
        while (bits < 16) {
          if (have === 0) break inf_leave;
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (state.wrap & 4 && hold !== (state.check & 65535)) {
          strm.msg = "header crc mismatch";
          state.mode = BAD;
          break;
        }
        hold = 0;
        bits = 0;
      }
      if (state.head) {
        state.head.hcrc = state.flags >> 9 & 1;
        state.head.done = true;
      }
      strm.adler = state.check = 0;
      state.mode = TYPE;
      break;
    case DICTID:
      while (bits < 32) {
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      strm.adler = state.check = zswap32(hold);
      hold = 0;
      bits = 0;
      state.mode = DICT;
    case DICT:
      if (state.havedict === 0) {
        strm.next_out = put;
        strm.avail_out = left;
        strm.next_in = next;
        strm.avail_in = have;
        state.hold = hold;
        state.bits = bits;
        return 2;
      }
      strm.adler = state.check = 1;
      state.mode = TYPE;
    case TYPE:
      if (flush === 5 || flush === 6) break inf_leave;
    case TYPEDO:
      if (state.last) {
        hold >>>= bits & 7;
        bits -= bits & 7;
        state.mode = CHECK;
        break;
      }
      while (bits < 3) {
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      state.last = hold & 1;
      hold >>>= 1;
      bits -= 1;
      switch (hold & 3) {
        case 0:
          state.mode = STORED;
          break;
        case 1:
          fixedtables(state);
          state.mode = LEN_;
          if (flush === 6) {
            hold >>>= 2;
            bits -= 2;
            break inf_leave;
          }
          break;
        case 2:
          state.mode = TABLE;
          break;
        case 3:
          strm.msg = "invalid block type";
          state.mode = BAD;
      }
      hold >>>= 2;
      bits -= 2;
      break;
    case STORED:
      hold >>>= bits & 7;
      bits -= bits & 7;
      while (bits < 32) {
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
        strm.msg = "invalid stored block lengths";
        state.mode = BAD;
        break;
      }
      state.length = hold & 65535;
      hold = 0;
      bits = 0;
      state.mode = COPY_;
      if (flush === 6) break inf_leave;
    case COPY_:
      state.mode = COPY;
    case COPY:
      copy = state.length;
      if (copy) {
        if (copy > have) copy = have;
        if (copy > left) copy = left;
        if (copy === 0) break inf_leave;
        output.set(input.subarray(next, next + copy), put);
        have -= copy;
        next += copy;
        left -= copy;
        put += copy;
        state.length -= copy;
        break;
      }
      state.mode = TYPE;
      break;
    case TABLE:
      while (bits < 14) {
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      state.nlen = (hold & 31) + 257;
      hold >>>= 5;
      bits -= 5;
      state.ndist = (hold & 31) + 1;
      hold >>>= 5;
      bits -= 5;
      state.ncode = (hold & 15) + 4;
      hold >>>= 4;
      bits -= 4;
      if (state.nlen > 286 || state.ndist > 30) {
        strm.msg = "too many length or distance symbols";
        state.mode = BAD;
        break;
      }
      state.have = 0;
      state.mode = LENLENS;
    case LENLENS:
      while (state.have < state.ncode) {
        while (bits < 3) {
          if (have === 0) break inf_leave;
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.lens[order[state.have++]] = hold & 7;
        hold >>>= 3;
        bits -= 3;
      }
      while (state.have < 19) state.lens[order[state.have++]] = 0;
      state.lencode = state.lendyn;
      state.lenbits = 7;
      opts = { bits: state.lenbits };
      ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
      state.lenbits = opts.bits;
      if (ret) {
        strm.msg = "invalid code lengths set";
        state.mode = BAD;
        break;
      }
      state.have = 0;
      state.mode = CODELENS;
    case CODELENS:
      while (state.have < state.nlen + state.ndist) {
        for (; ; ) {
          here = state.lencode[hold & (1 << state.lenbits) - 1];
          here_bits = here >>> 24;
          here_op = here >>> 16 & 255;
          here_val = here & 65535;
          if (here_bits <= bits) break;
          if (have === 0) break inf_leave;
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (here_val < 16) {
          hold >>>= here_bits;
          bits -= here_bits;
          state.lens[state.have++] = here_val;
        } else {
          if (here_val === 16) {
            n = here_bits + 2;
            while (bits < n) {
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            if (state.have === 0) {
              strm.msg = "invalid bit length repeat";
              state.mode = BAD;
              break;
            }
            len = state.lens[state.have - 1];
            copy = 3 + (hold & 3);
            hold >>>= 2;
            bits -= 2;
          } else if (here_val === 17) {
            n = here_bits + 3;
            while (bits < n) {
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            len = 0;
            copy = 3 + (hold & 7);
            hold >>>= 3;
            bits -= 3;
          } else {
            n = here_bits + 7;
            while (bits < n) {
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            len = 0;
            copy = 11 + (hold & 127);
            hold >>>= 7;
            bits -= 7;
          }
          if (state.have + copy > state.nlen + state.ndist) {
            strm.msg = "invalid bit length repeat";
            state.mode = BAD;
            break;
          }
          while (copy--) state.lens[state.have++] = len;
        }
      }
      if (state.mode === BAD) break;
      if (state.lens[256] === 0) {
        strm.msg = "invalid code -- missing end-of-block";
        state.mode = BAD;
        break;
      }
      state.lenbits = 9;
      opts = { bits: state.lenbits };
      ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
      state.lenbits = opts.bits;
      if (ret) {
        strm.msg = "invalid literal/lengths set";
        state.mode = BAD;
        break;
      }
      state.distbits = 6;
      state.distcode = state.distdyn;
      opts = { bits: state.distbits };
      ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
      state.distbits = opts.bits;
      if (ret) {
        strm.msg = "invalid distances set";
        state.mode = BAD;
        break;
      }
      state.mode = LEN_;
      if (flush === 6) break inf_leave;
    case LEN_:
      state.mode = LEN;
    case LEN:
      if (have >= 6 && left >= 258) {
        strm.next_out = put;
        strm.avail_out = left;
        strm.next_in = next;
        strm.avail_in = have;
        state.hold = hold;
        state.bits = bits;
        inflate_fast(strm, _out);
        put = strm.next_out;
        output = strm.output;
        left = strm.avail_out;
        next = strm.next_in;
        input = strm.input;
        have = strm.avail_in;
        hold = state.hold;
        bits = state.bits;
        if (state.mode === TYPE) state.back = -1;
        break;
      }
      state.back = 0;
      for (; ; ) {
        here = state.lencode[hold & (1 << state.lenbits) - 1];
        here_bits = here >>> 24;
        here_op = here >>> 16 & 255;
        here_val = here & 65535;
        if (here_bits <= bits) break;
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      if (here_op && (here_op & 240) === 0) {
        last_bits = here_bits;
        last_op = here_op;
        last_val = here_val;
        for (; ; ) {
          here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
          here_bits = here >>> 24;
          here_op = here >>> 16 & 255;
          here_val = here & 65535;
          if (last_bits + here_bits <= bits) break;
          if (have === 0) break inf_leave;
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        hold >>>= last_bits;
        bits -= last_bits;
        state.back += last_bits;
      }
      hold >>>= here_bits;
      bits -= here_bits;
      state.back += here_bits;
      state.length = here_val;
      if (here_op === 0) {
        state.mode = LIT;
        break;
      }
      if (here_op & 32) {
        state.back = -1;
        state.mode = TYPE;
        break;
      }
      if (here_op & 64) {
        strm.msg = "invalid literal/length code";
        state.mode = BAD;
        break;
      }
      state.extra = here_op & 15;
      state.mode = LENEXT;
    case LENEXT:
      if (state.extra) {
        n = state.extra;
        while (bits < n) {
          if (have === 0) break inf_leave;
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.length += hold & (1 << state.extra) - 1;
        hold >>>= state.extra;
        bits -= state.extra;
        state.back += state.extra;
      }
      state.was = state.length;
      state.mode = DIST;
    case DIST:
      for (; ; ) {
        here = state.distcode[hold & (1 << state.distbits) - 1];
        here_bits = here >>> 24;
        here_op = here >>> 16 & 255;
        here_val = here & 65535;
        if (here_bits <= bits) break;
        if (have === 0) break inf_leave;
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      if ((here_op & 240) === 0) {
        last_bits = here_bits;
        last_op = here_op;
        last_val = here_val;
        for (; ; ) {
          here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
          here_bits = here >>> 24;
          here_op = here >>> 16 & 255;
          here_val = here & 65535;
          if (last_bits + here_bits <= bits) break;
          if (have === 0) break inf_leave;
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        hold >>>= last_bits;
        bits -= last_bits;
        state.back += last_bits;
      }
      hold >>>= here_bits;
      bits -= here_bits;
      state.back += here_bits;
      if (here_op & 64) {
        strm.msg = "invalid distance code";
        state.mode = BAD;
        break;
      }
      state.offset = here_val;
      state.extra = here_op & 15;
      state.mode = DISTEXT;
    case DISTEXT:
      if (state.extra) {
        n = state.extra;
        while (bits < n) {
          if (have === 0) break inf_leave;
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.offset += hold & (1 << state.extra) - 1;
        hold >>>= state.extra;
        bits -= state.extra;
        state.back += state.extra;
      }
      if (state.offset > state.dmax) {
        strm.msg = "invalid distance too far back";
        state.mode = BAD;
        break;
      }
      state.mode = MATCH;
    case MATCH:
      if (left === 0) break inf_leave;
      copy = _out - left;
      if (state.offset > copy) {
        copy = state.offset - copy;
        if (copy > state.whave) {
          if (state.sane) {
            strm.msg = "invalid distance too far back";
            state.mode = BAD;
            break;
          }
        }
        if (copy > state.wnext) {
          copy -= state.wnext;
          from = state.wsize - copy;
        } else from = state.wnext - copy;
        if (copy > state.length) copy = state.length;
        from_source = state.window;
      } else {
        from_source = output;
        from = put - state.offset;
        copy = state.length;
      }
      if (copy > left) copy = left;
      left -= copy;
      state.length -= copy;
      do
        output[put++] = from_source[from++];
      while (--copy);
      if (state.length === 0) state.mode = LEN;
      break;
    case LIT:
      if (left === 0) break inf_leave;
      output[put++] = state.length;
      left--;
      state.mode = LEN;
      break;
    case CHECK:
      if (state.wrap) {
        while (bits < 32) {
          if (have === 0) break inf_leave;
          have--;
          hold |= input[next++] << bits;
          bits += 8;
        }
        _out -= left;
        strm.total_out += _out;
        state.total += _out;
        if (state.wrap & 4 && _out) strm.adler = state.check = state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
        _out = left;
        if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
          strm.msg = "incorrect data check";
          state.mode = BAD;
          break;
        }
        hold = 0;
        bits = 0;
      }
      state.mode = LENGTH;
    case LENGTH:
      if (state.wrap && state.flags) {
        while (bits < 32) {
          if (have === 0) break inf_leave;
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
          strm.msg = "incorrect length check";
          state.mode = BAD;
          break;
        }
        hold = 0;
        bits = 0;
      }
      state.mode = DONE;
    case DONE:
      ret = 1;
      break inf_leave;
    case BAD:
      ret = -3;
      break inf_leave;
    case MEM:
      return -4;
    case SYNC:
    default:
      return -2;
  }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== 4)) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
      state.mode = MEM;
      return -4;
    }
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap & 4 && _out) strm.adler = state.check = state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === 4) && ret === 0) ret = -5;
  return ret;
};
var inflateEnd = (strm) => {
  if (inflateStateCheck(strm)) return -2;
  let state = strm.state;
  if (state.window) state.window = null;
  strm.state = null;
  return 0;
};
var inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length;
  let state;
  let dictid;
  let ret;
  if (inflateStateCheck(strm)) return -2;
  state = strm.state;
  if (state.wrap !== 0 && state.mode !== DICT) return -2;
  if (state.mode === DICT) {
    dictid = 1;
    dictid = adler32(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) return -3;
  }
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return -4;
  }
  state.havedict = 1;
  return 0;
};
var ZStream = class {
  constructor() {
    this.input = null;
    this.next_in = 0;
    this.avail_in = 0;
    this.total_in = 0;
    this.output = null;
    this.next_out = 0;
    this.avail_out = 0;
    this.total_out = 0;
    this.msg = "";
    this.state = null;
    this.data_type = 2;
    this.adler = 0;
  }
};
var flattenChunks = (chunks) => {
  const result = new Uint8Array(chunks.reduce((len, chunk) => len + chunk.length, 0));
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
};
var toString$1 = Object.prototype.toString;
var defaultOptions$1 = {
  level: -1,
  chunkSize: 16384,
  windowBits: 15,
  memLevel: 8,
  strategy: 0,
  raw: false,
  gzip: false,
  legacyHash: false,
  dictionary: /* @__PURE__ */ new Uint8Array(0)
};
var Deflate = class {
  options;
  /**
  * Error code after deflate finishes. {@link Z_OK} on success.
  * You will not need it in real life, because deflate errors
  * are possible only on wrong options or bad custom `onData` / `onEnd`
  * handlers.
  */
  err;
  /** Error message, if {@link Deflate.err} is not {@link Z_OK}. */
  msg;
  ended;
  started;
  /**
  * Chunks of output data, if {@link Deflate.onData} not overridden.
  * @internal
  */
  chunks;
  strm;
  /**
  * Compressed result, generated by default {@link Deflate.onData}
  * and {@link Deflate.onEnd} handlers. Filled after you push last chunk
  * (call {@link Deflate.push} with {@link Z_FINISH} / `true` param).
  */
  result;
  /**
  * Creates a new deflator instance with the specified params. Throws an
  * exception on bad params. See {@link DeflateOptions} for the list of
  * supported options.
  *
  * @example
  * ```javascript
  * import { Deflate } from 'pako'
  *
  * const chunk1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
  * const chunk2 = new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
  *
  * const deflate = new Deflate({ level: 3 })
  *
  * deflate.push(chunk1, false)
  * deflate.push(chunk2, true)  // true -> last chunk
  *
  * if (deflate.err) throw new Error(deflate.err)
  *
  * console.log(deflate.result)
  * ```
  */
  constructor(options = {}) {
    this.options = Object.assign({}, defaultOptions$1, options);
    const opt = this.options;
    if (opt.raw && opt.windowBits > 0) opt.windowBits = -opt.windowBits;
    else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) opt.windowBits += 16;
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.started = false;
    this.chunks = [];
    this.result = /* @__PURE__ */ new Uint8Array(0);
    this.strm = new ZStream();
    this.strm.avail_out = 0;
    let status = deflateInit2(this.strm, opt.level, 8, opt.windowBits, opt.memLevel, opt.strategy, opt.legacyHash);
    if (status !== 0) throw new Error(messages_default[status]);
    if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") opt.dictionary = new Uint8Array(opt.dictionary);
    const dictionary = opt.dictionary;
    if (dictionary.length) {
      if (opt.gzip) throw new Error("dictionary is not supported with gzip");
      status = deflateSetDictionary(this.strm, dictionary);
      if (status !== 0) throw new Error(messages_default[status]);
    }
  }
  /**
  * Sends input data to the deflate pipe, generating {@link Deflate.onData} calls
  * with new compressed chunks. Returns `true` on success. The last data block must
  * have `flush_mode` {@link Z_FINISH} (or `true`). That will flush the internal
  * pending buffers and call {@link Deflate.onEnd}.
  *
  * On failure, calls {@link Deflate.onEnd} with the error code and returns false.
  *
  * @param data input data. Strings will be converted to utf8 byte sequence.
  * @param flush_mode 0..6 for corresponding {@link Z_NO_FLUSH}..{@link Z_TREES} modes.
  *   See constants. Skipped or `false` means {@link Z_NO_FLUSH}, `true` means {@link Z_FINISH}.
  *
  * @example
  * ```javascript
  * push(chunk, false) // push one of data chunks
  * ...
  * push(chunk, true)  // push last chunk
  * ```
  */
  push(data, flush_mode = false) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    let status;
    let _flush_mode;
    if (this.ended) return false;
    if (typeof flush_mode === "number") _flush_mode = flush_mode;
    else _flush_mode = flush_mode === true ? 4 : 0;
    if (typeof data === "string") strm.input = new TextEncoder().encode(data);
    else if (toString$1.call(data) === "[object ArrayBuffer]") strm.input = new Uint8Array(data);
    else strm.input = data;
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    if (!this.started) {
      this.started = true;
      this.onStart(strm);
    }
    for (; ; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      if ((_flush_mode === 2 || _flush_mode === 3) && strm.avail_out <= 6) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      status = deflate$1(strm, _flush_mode);
      if (status === -2) break;
      if (status === 1) {
        if (strm.next_out > 0) this.onData(strm.output.subarray(0, strm.next_out));
        status = deflateEnd(this.strm);
        break;
      }
      if (strm.avail_out === 0) {
        this.onData(strm.output);
        continue;
      }
      if (_flush_mode > 0 && strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      if (strm.avail_in === 0) return true;
    }
    this.err = status;
    this.msg = strm.msg || messages_default[status];
    this.ended = true;
    this.onEnd(status);
    return status === 0;
  }
  /**
  * Called once before the first low-level deflate call.
  */
  onStart(strm) {
  }
  /**
  * By default, stores data blocks in the {@link Deflate.chunks} property and glues
  * them in {@link Deflate.onEnd}. Override this handler if you need another behaviour.
  */
  onData(chunk) {
    this.chunks.push(chunk);
  }
  /**
  * Called once after you tell deflate that the input stream is
  * complete ({@link Z_FINISH}). By default, joins the collected {@link Deflate.chunks}
  * into the {@link Deflate.result} property.
  *
  * @param status deflate status. {@link Z_OK} on success, other if not.
  */
  onEnd(status) {
    if (status === 0) this.result = flattenChunks(this.chunks);
    this.chunks = [];
  }
};
function deflate(input, options = {}) {
  const deflator = new Deflate(options);
  deflator.push(input, true);
  if (deflator.err) throw new Error(deflator.msg);
  return deflator.result;
}
var toString = Object.prototype.toString;
var defaultOptions = {
  chunkSize: 1024 * 64,
  windowBits: 15,
  raw: false,
  dictionary: /* @__PURE__ */ new Uint8Array(0)
};
var Inflate = class {
  options;
  /**
  * Error code after inflate finishes. {@link Z_OK} on success.
  * Should be checked when broken data is possible.
  */
  err;
  /** Error message, if {@link Inflate.err} is not {@link Z_OK}. */
  msg;
  /**
  * `true` once the compressed stream has ended. A stream may end before the
  * caller's data does (trailing bytes), so check this to know when to stop
  * pushing - further {@link Inflate.push} calls are no-ops.
  */
  ended;
  started;
  /**
  * Chunks of output data, if {@link Inflate.onData} not overridden.
  * @internal
  */
  chunks;
  strm;
  /**
  * Uncompressed result, generated by default {@link Inflate.onData}
  * and {@link Inflate.onEnd} handlers. Filled after you push last chunk
  * (call {@link Inflate.push} with {@link Z_FINISH} / `true` param).
  */
  result;
  /**
  * Creates a new inflator instance with the specified params. Throws an
  * exception on bad params. See {@link InflateOptions} for the list of
  * supported options.
  *
  * By default, when no options are set, the deflate/gzip data format is
  * autodetected via the wrapper header.
  *
  * @example
  * ```javascript
  * import { Inflate } from 'pako'
  *
  * const chunk1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
  * const chunk2 = new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
  *
  * const inflate = new Inflate({ level: 3 })
  *
  * inflate.push(chunk1, false)
  * inflate.push(chunk2, true)  // true -> last chunk
  *
  * if (inflate.err) throw new Error(inflate.err)
  *
  * console.log(inflate.result)
  * ```
  */
  constructor(options = {}) {
    this.options = Object.assign({}, defaultOptions, options);
    const opt = this.options;
    if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
      opt.windowBits = -opt.windowBits;
      if (opt.windowBits === 0) opt.windowBits = -15;
    }
    if (opt.windowBits >= 0 && opt.windowBits < 16 && !options.windowBits) opt.windowBits += 32;
    if (opt.windowBits > 15 && opt.windowBits < 48) {
      if ((opt.windowBits & 15) === 0) opt.windowBits |= 15;
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.started = false;
    this.chunks = [];
    this.result = /* @__PURE__ */ new Uint8Array(0);
    this.strm = new ZStream();
    this.strm.avail_out = 0;
    let status = inflateInit2(this.strm, opt.windowBits);
    if (status !== 0) throw new Error(messages_default[status]);
    if (toString.call(opt.dictionary) === "[object ArrayBuffer]") opt.dictionary = new Uint8Array(opt.dictionary);
    const dictionary = opt.dictionary;
    if (opt.raw && dictionary.length) {
      status = inflateSetDictionary(this.strm, dictionary);
      if (status !== 0) throw new Error(messages_default[status]);
    }
  }
  /**
  * Sends input data to the inflate pipe, generating {@link Inflate.onData} calls
  * with new output chunks. Returns `true` on success. If end of stream is
  * detected, {@link Inflate.onEnd} will be called.
  *
  * `flush_mode` is not needed for normal operation, because end of stream
  * is detected automatically. Pass {@link Z_SYNC_FLUSH} to force the decoder
  * to emit all currently available output — handy when you need to decode
  * data frame-by-frame from a long-running stream.
  *
  * On failure, calls {@link Inflate.onEnd} with the error code and returns false.
  *
  * Once the stream has ended (a compressed stream may end before your data
  * does), further `push` calls are no-ops and return whether the decode
  * finished successfully. The final outcome is in {@link Inflate.result},
  * {@link Inflate.err} and {@link Inflate.msg}.
  *
  * @param flush_mode 0..6 for corresponding {@link Z_NO_FLUSH}..{@link Z_TREES}
  *   flush modes. See constants. Skipped or `false` means {@link Z_NO_FLUSH},
  *   `true` means {@link Z_FINISH}.
  *
  * @example
  * ```javascript
  * push(chunk, false) // push one of data chunks
  * ...
  * push(chunk, true)  // push last chunk
  * ```
  */
  push(data, flush_mode = false) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    let status;
    let _flush_mode;
    let last_avail_out;
    if (this.ended) return this.err === 0;
    if (typeof flush_mode === "number") _flush_mode = flush_mode;
    else _flush_mode = flush_mode === true ? 4 : 0;
    if (toString.call(data) === "[object ArrayBuffer]") strm.input = new Uint8Array(data);
    else strm.input = data;
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    if (!this.started) {
      this.started = true;
      this.onStart(strm);
    }
    for (; ; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      status = inflate$1(strm, _flush_mode);
      if (status === 2) {
        const dictionary = this.options.dictionary;
        if (dictionary.length) {
          status = inflateSetDictionary(strm, dictionary);
          if (status === 0) status = inflate$1(strm, _flush_mode);
          else if (status === -3) status = 2;
        }
      }
      while (strm.avail_in > 0 && status === 1 && strm.state.wrap & 2 && strm.state.flags !== 0 && strm.input[strm.next_in] !== 0) {
        inflateReset(strm);
        status = inflate$1(strm, _flush_mode);
      }
      if (status === -2 || status === -3 || status === 2 || status === -4) break;
      last_avail_out = strm.avail_out;
      if (strm.next_out) {
        if (strm.avail_out === 0 || status === 1 || _flush_mode > 0) {
          this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
          strm.avail_out = 0;
          strm.next_out = 0;
        }
      }
      if ((status === 0 || status === -5) && last_avail_out === 0) continue;
      if (status === 1) {
        status = inflateEnd(this.strm);
        break;
      }
      if (strm.avail_in === 0) {
        if (_flush_mode === 4) {
          status = inflateEnd(this.strm);
          if (status === 0) status = -5;
          break;
        }
        return true;
      }
    }
    this.err = status;
    this.msg = strm.msg || messages_default[status];
    this.ended = true;
    this.onEnd(status);
    return status === 0;
  }
  /**
  * Called once before the first low-level inflate call.
  *
  * Override this handler to attach low-level inflate state, for example to read
  * gzip header metadata:
  *
  * ```javascript
  * import { Inflate, GZheader, zlibInflateGetHeader } from 'pako'
  *
  * const inflator = new Inflate()
  *
  * inflator.onStart = function (strm) {
  *   this.header = new GZheader()
  *   zlibInflateGetHeader(strm, this.header)
  * }
  *
  * inflator.push(data, true)
  * console.log(inflator.header.name)
  * ```
  */
  onStart(strm) {
  }
  /**
  * By default, stores data blocks in the {@link Inflate.chunks} property and glues
  * them in {@link Inflate.onEnd}. Override this handler if you need another behaviour.
  *
  * @param chunk output data.
  */
  onData(chunk) {
    this.chunks.push(chunk);
  }
  /**
  * Called after you tell inflate that the input stream is
  * complete ({@link Z_FINISH}). By default, joins the collected {@link Inflate.chunks},
  * frees memory and fills the {@link Inflate.result} property.
  *
  * @param status inflate status. {@link Z_OK} on success, other if not.
  */
  onEnd(status) {
    if (status === 0) this.result = flattenChunks(this.chunks);
    this.chunks = [];
  }
};

// node_modules/@uttori/data-tools/dist/data-helpers.js
var validateBytes = (uint8, length) => {
  if (uint8.length < length) {
    throw new RangeError(`Insufficient bytes: expected at least ${length}, received ${uint8.length}.`);
  }
  if (Array.isArray(uint8)) {
    for (let i = 0; i < length; i++) {
      if (!Number.isInteger(uint8[i]) || uint8[i] < 0 || uint8[i] > 255) {
        throw new RangeError(`Invalid byte at index ${i}: ${uint8[i]}`);
      }
    }
  }
};
var decodeExtended = (sign, exponent, high, low) => {
  if (exponent === 32767) {
    return (high & 2147483647) === 0 && low === 0 ? sign * Infinity : Number.NaN;
  }
  if (high === 0 && low === 0) {
    return sign * 0;
  }
  const adjustedExponent = (exponent === 0 ? 1 : exponent) - 16383;
  if (high >= 2147483648 && adjustedExponent >= -1022 && adjustedExponent <= 1023) {
    return sign * ((high / 2147483648 + low / 9223372036854776e3) * 2 ** adjustedExponent);
  }
  const highestBit = high === 0 ? 31 - Math.clz32(low) : 63 - Math.clz32(high);
  const power = adjustedExponent + highestBit - 63;
  if (power > 1023) {
    return sign * Infinity;
  }
  if (power < -1075) {
    return sign * 0;
  }
  if (power >= -1022) {
    const mantissa2 = high * 4294967296 + low;
    return sign * (mantissa2 / 2 ** highestBit * 2 ** power);
  }
  const mantissa = BigInt(high) << 32n | BigInt(low);
  const shift = adjustedExponent + 1011;
  let rounded;
  if (shift >= 0) {
    rounded = mantissa << BigInt(shift);
  } else {
    const discarded = BigInt(-shift);
    rounded = mantissa >> discarded;
    const remainder = mantissa - (rounded << discarded);
    const half = 1n << discarded - 1n;
    if (remainder > half || remainder === half && (rounded & 1n) !== 0n) {
      rounded++;
    }
  }
  return sign * (Number(rounded) * Number.MIN_VALUE);
};
var float48 = (uint8) => {
  validateBytes(uint8, 6);
  let mantissa = 0;
  let exponent = uint8[0];
  if (exponent === 0) {
    return 0;
  }
  exponent = uint8[0] - 129;
  for (let i = 1; i <= 4; i++) {
    mantissa += uint8[i];
    mantissa /= 256;
  }
  mantissa += uint8[5] & 127;
  mantissa /= 128;
  mantissa += 1;
  if (uint8[5] & 128) {
    mantissa = -mantissa;
  }
  const output = mantissa * 2 ** exponent;
  return output;
};
var float80 = (uint8) => {
  validateBytes(uint8, 10);
  const high = (uint8[7] << 24 | uint8[6] << 16 | uint8[5] << 8 | uint8[4]) >>> 0;
  const low = (uint8[3] << 24 | uint8[2] << 16 | uint8[1] << 8 | uint8[0]) >>> 0;
  const a0 = uint8[9];
  const a1 = uint8[8];
  const sign = 1 - (a0 >>> 7) * 2;
  const exponent = (a0 & 127) << 8 | a1;
  return decodeExtended(sign, exponent, high, low);
};
var convertFromIeeeExtended = (uint8) => {
  validateBytes(uint8, 10);
  const sign = uint8[0] & 128 ? -1 : 1;
  const exponent = (uint8[0] & 127) << 8 | uint8[1];
  const hiMant = (uint8[2] << 24 | uint8[3] << 16 | uint8[4] << 8 | uint8[5]) >>> 0;
  const loMant = (uint8[6] << 24 | uint8[7] << 16 | uint8[8] << 8 | uint8[9]) >>> 0;
  return decodeExtended(sign, exponent, hiMant, loMant);
};

// node_modules/@uttori/data-tools/dist/underflow-error.js
var UnderflowError = class extends Error {
  /**
   * Creates a new UnderflowError.
   * @param message Message to show when the error is thrown.
   * @class
   */
  constructor(message) {
    super(message);
    this.name = "UnderflowError";
    this.stack = new Error(message).stack;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};
var underflow_error_default = UnderflowError;

// node_modules/@uttori/data-tools/dist/data-buffer.js
function dataBufferBrand() {
  return /* @__PURE__ */ Symbol.for("uttori.DataBuffer");
}
var DATA_BUFFER_BRAND = /* @__PURE__ */ dataBufferBrand();
function nativeEndian() {
  return new Uint16Array(new Uint8Array([18, 52]).buffer)[0] === 13330;
}
var NATIVE_ENDIAN = /* @__PURE__ */ nativeEndian();
var debug = (..._args) => {
};
if (typeof process !== "undefined" && false) {
  try {
    const { default: d } = null;
    debug = d("DataBuffer");
  } catch {
  }
}
var DataBuffer = class _DataBuffer {
  /** Bytes owned or borrowed by this view. */
  data = new Uint8Array(0);
  /** Is this instance for creating a new file? */
  writing = false;
  /** Native Endianness of the machine, true is Little Endian, false is Big Endian */
  nativeEndian = false;
  /** Reading / Writing offset */
  offset = 0;
  /** Backing store for the internal write buffer, null until first write to avoid copying when read-only, based on `this.writing` flag. */
  _buffer = null;
  /** The number of bytes avaliable to read. */
  lengthInBytes = 0;
  /** When the buffer is part of a bufferlist, the next DataBuffer in the list. */
  next = null;
  /** When the buffer is part of a bufferlist, the previous DataBuffer in the list. */
  prev = null;
  /** Cached numeric view, bounded to data. */
  #dataView = null;
  /** The data identity and byte length used to construct the cached numeric view. */
  #viewData = null;
  #viewLength = -1;
  /**
   * Reuse the numeric view until data is replaced or its backing buffer is resized.
   * Do not inspect the old DataView's byte length, a resize may have made it out of bounds.
   * @returns {DataView} A view covering exactly the current data.
   */
  get #view() {
    const { data } = this;
    if (this.#dataView === null || this.#viewData !== data || this.#viewLength !== data.byteLength) {
      this.#dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
      this.#viewData = data;
      this.#viewLength = data.byteLength;
    }
    return this.#dataView;
  }
  /**
   * Validate the complete write range before initializing or modifying the staging array.
   * Array indices stop before 0xFFFFFFFF, which is the maximum number[] length.
   * @param {number} bytes The number of staged elements to write.
   * @param {number} offset The destination offset.
   * @throws {RangeError} The write range is not a valid array range.
   */
  #validateWrite(bytes, offset) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || !Number.isSafeInteger(offset) || offset < 0 || bytes > 4294967295 - offset) {
      throw new RangeError(`Invalid write range: ${offset} + ${bytes}`);
    }
  }
  /**
   * Creates an instance of DataBuffer.
   * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array} [input] The data to process.
   * Omitted input creates an empty writable buffer.
   * @throws {RangeError} The requested numeric length is not a nonnegative safe integer.
   * @throws {TypeError} Unknown type of input for DataBuffer: ${typeof input}
   */
  constructor(input) {
    this.writing = false;
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
      debug("constructor: from Buffer");
      this.data = Buffer.from(input);
    } else if (typeof input === "string") {
      debug("constructor: from string");
      this.data = new TextEncoder().encode(input);
    } else if (input instanceof Uint8Array) {
      debug("constructor: from Uint8Array");
      if (input.buffer instanceof ArrayBuffer) {
        this.data = input;
      } else {
        this.data = new Uint8Array(input);
      }
    } else if (input instanceof ArrayBuffer) {
      debug("constructor: from ArrayBuffer");
      this.data = new Uint8Array(input);
    } else if (Array.isArray(input)) {
      debug("constructor: Normal Array");
      this.data = new Uint8Array(input);
    } else if (typeof input === "number") {
      debug("constructor: Number (i.e. length)");
      if (!Number.isSafeInteger(input) || input < 0) {
        throw new RangeError(`Invalid buffer length: ${input}`);
      }
      this.data = new Uint8Array(input);
    } else if (input instanceof _DataBuffer) {
      debug("constructor: from DataBuffer, a shallow copy");
      this.data = input.data;
    } else if (ArrayBuffer.isView(input) && "BYTES_PER_ELEMENT" in input && input.buffer instanceof ArrayBuffer) {
      debug("constructor: from typed arrays other than Uint8Array");
      this.data = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else if (typeof input === "undefined") {
      debug("constructor: empty, creating a new file from scratch");
      this.writing = true;
      this.data = new Uint8Array();
    } else {
      const error = `Unknown type of input for DataBuffer: ${typeof input}`;
      debug(error);
      throw new TypeError(error);
    }
    this.lengthInBytes = this.data.length;
    this.next = null;
    this.prev = null;
    Object.defineProperty(this, DATA_BUFFER_BRAND, { value: true });
    this.nativeEndian = NATIVE_ENDIAN;
    this.offset = 0;
    this._buffer = this.writing ? [] : null;
  }
  /**
   * Buffer for creating new files. Lazy-inits from a copy of data on first write when instance was created read-only.
   * @returns {number[]} The buffer.
   */
  get buffer() {
    if (this._buffer === null) {
      this._buffer = this.data.length ? Array.from(this.data) : [];
    }
    return this._buffer;
  }
  /**
   * Creates an instance of DataBuffer with given size.
   * @param {number} size The size of the requested DataBuffer.
   * @returns {DataBuffer} The new DataBuffer.
   */
  static allocate(size) {
    debug("DataBuffer.allocate:", size);
    return new _DataBuffer(size);
  }
  /**
   * Helper to match arrays by returning the data length.
   * @returns {number} The data length of the DataBuffer.
   */
  get length() {
    return this.data.length;
  }
  /**
   * Compares another DataBuffer against the current data buffer at a specified offset.
   * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array|undefined} input The data to compare against the current DataBuffer.
   * @param {number} [offset] The offset in the current DataBuffer to start comparing, default is 0.
   * @returns {boolean} Returns true when all input bytes match the region at offset, false if there is any difference, the input is empty, or the region is out of bounds.
   */
  compare(input, offset = 0) {
    let data;
    if (input instanceof _DataBuffer) {
      data = input.data;
    } else if (input instanceof Uint8Array) {
      data = input;
    } else {
      data = new _DataBuffer(input).data;
    }
    const { length } = data;
    if (!length) {
      debug("compare: no input provided");
      return false;
    }
    if (!this.availableAt(length, offset, false)) {
      return false;
    }
    const current = this.data;
    if (data === current && offset === 0) {
      return true;
    }
    for (let i = 0; i < length; i++) {
      if (current[offset + i] !== data[i]) {
        debug("compare: first failed match at", i);
        return false;
      }
    }
    debug("compare: data is the same");
    return true;
  }
  /**
   * Compares input data against the upcoming data, byte by byte.
   * @param {number[] | Buffer | Uint8Array} input The data to check for in upcoming bytes.
   * @returns {boolean} `true` if the data is the upcoming data, `false` if it is not or there is not enough buffer remaining.
   */
  isNextBytes(input) {
    debug("isNextBytes:", input);
    if (!input || typeof input.length !== "number" || input.length === 0) {
      debug("isNextBytes: no input provided");
      return false;
    }
    if (!this.available(input.length, false)) {
      debug(`isNextBytes: Insufficient Bytes: ${input.length} <= ${this.remainingBytes()}`);
      return false;
    }
    debug("isNextBytes: this.offset =", this.offset);
    const off = this.offset;
    for (let i = 0; i < input.length; i++) {
      if (input[i] !== this.data[off + i]) {
        debug("isNextBytes: first failed match at", i, ", where:", input[i], "!==", this.data[off + i]);
        return false;
      }
    }
    return true;
  }
  /**
   * Creates a copy of the current DataBuffer.
   * @returns {DataBuffer} A new copy of the current DataBuffer.
   */
  copy() {
    debug("copy");
    return new _DataBuffer(new Uint8Array(this.data));
  }
  /**
   * Creates a copy of the current DataBuffer from a specified offset and a specified length.
   * @param {number} position The starting offset to begin the copy of the new DataBuffer.
   * @param {number} [length] The size of the new DataBuffer, defaults to the current length.
   * @returns {DataBuffer} The new DataBuffer
   */
  slice(position, length = this.length) {
    debug("slice:", position, length);
    if (!Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(length) || length < 0) {
      throw new RangeError(`Invalid slice range: ${position} + ${length}`);
    }
    return new _DataBuffer(new Uint8Array(this.data.subarray(position, position + length)));
  }
  /**
   * Returns the remaining bytes to be read in the DataBuffer.
   * @returns {number} The remaining bytes to bre read in the DataBuffer.
   */
  remainingBytes() {
    return this.length - this.offset;
  }
  /**
   * Checks if a given number of bytes are avaliable in the DataBuffer.
   * If writing mode is enabled, this is true for valid nonnegative integer ranges.
   * Pass false for writing when checking committed bytes for a read.
   * @param {number} bytes The number of bytes to check for.
   * @param {boolean} [writing] Allow growth instead of requiring committed bytes, default is this.writing.
   * @returns {boolean} True if there are the requested amount, or more, of bytes left in the DataBuffer.
   */
  available(bytes, writing = this.writing) {
    return this.availableAt(bytes, this.offset, writing);
  }
  /**
   * Checks if a given number of bytes are avaliable after a given offset in the buffer.
   * If writing mode is enabled, this is true for valid nonnegative integer ranges.
   * Pass false for writing when checking committed bytes for a read.
   * @param {number} bytes The number of bytes to check for.
   * @param {number} offset The offset to start from.
   * @param {boolean} [writing] Allow growth instead of requiring committed bytes, default is this.writing.
   * @returns {boolean} True if there are the requested amount, or more, of bytes left in the stream.
   */
  availableAt(bytes, offset, writing = this.writing) {
    return Number.isSafeInteger(bytes) && bytes >= 0 && Number.isSafeInteger(offset) && offset >= 0 && (writing ? bytes <= Number.MAX_SAFE_INTEGER - offset : bytes <= this.length - offset);
  }
  /**
   * Advance the offset by a given number of bytes.
   * @param {number} bytes The number of bytes to advance.
   * @throws {RangeError} The byte count or current offset is not a nonnegative safe integer.
   * @throws {UnderflowError} Insufficient Bytes in the DataBuffer.
   */
  advance(bytes) {
    debug("advance:", bytes);
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new RangeError(`Invalid byte count: ${bytes}`);
    }
    if (!Number.isSafeInteger(this.offset) || this.offset < 0) {
      throw new RangeError(`Invalid offset: ${this.offset}`);
    }
    if (!this.available(bytes)) {
      throw new underflow_error_default(`Insufficient Bytes: ${bytes} <= ${this.remainingBytes()}`);
    }
    this.offset += bytes;
    debug("advance: offset", this.offset);
  }
  /**
   * Rewind the offset by a given number of bytes.
   * @param {number} bytes The number of bytes to go back.
   * @throws {RangeError} The byte count or current offset is not a nonnegative safe integer.
   * @throws {UnderflowError} Insufficient Bytes in the DataBuffer.
   */
  rewind(bytes) {
    debug("rewind:", bytes);
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new RangeError(`Invalid byte count: ${bytes}`);
    }
    if (!Number.isSafeInteger(this.offset) || this.offset < 0) {
      throw new RangeError(`Invalid offset: ${this.offset}`);
    }
    if (bytes > this.offset) {
      throw new underflow_error_default(`Insufficient Bytes: ${bytes} > ${this.offset}`);
    }
    this.offset -= bytes;
    debug("rewind: offset", this.offset);
  }
  /**
   * Go to a specified offset in the stream.
   * @param {number} position The offset to go to.
   * @throws {RangeError} The requested position or current offset is not a nonnegative safe integer.
   */
  seek(position) {
    debug(`seek: from ${this.offset} to ${position}`);
    if (!Number.isSafeInteger(position) || position < 0) {
      throw new RangeError(`Invalid position: ${position}`);
    }
    if (!Number.isSafeInteger(this.offset) || this.offset < 0) {
      throw new RangeError(`Invalid offset: ${this.offset}`);
    }
    if (position === this.offset && !this.available(0)) {
      throw new underflow_error_default(`Insufficient Bytes: 0 <= ${this.remainingBytes()}`);
    }
    if (position > this.offset) {
      this.advance(position - this.offset);
    }
    if (position < this.offset) {
      this.rewind(this.offset - position);
    }
    debug(`seek: offset is ${this.offset}`);
  }
  /**
   * Read from the current offset and return the value.
   * @returns {number} The UInt8 value at the current offset.
   * @throws {UnderflowError} Insufficient Bytes in the stream.
   */
  readUInt8() {
    if (!this.available(1, false)) {
      throw new underflow_error_default("Insufficient Bytes: 1");
    }
    const output = this.data[this.offset];
    this.offset += 1;
    return output;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @returns {number} The UInt8 value at the current offset.
   * @throws {UnderflowError} Insufficient Bytes in the stream.
   */
  peekUInt8(offset = 0) {
    if (!this.availableAt(1, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 1`);
    }
    return this.data[offset];
  }
  /**
   * Read from the current offset and return the value.
   * @param {number} bytes The number of bytes to read.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {Uint8Array} The UInt8 value at the current offset.
   */
  read(bytes, littleEndian2 = false) {
    if (!this.available(bytes, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${bytes}`);
    }
    const start = this.offset;
    if (littleEndian2 && bytes > 1) {
      const uint82 = new Uint8Array(bytes);
      for (let i = 0; i < bytes; i++) {
        uint82[i] = this.data[start + bytes - 1 - i];
      }
      this.offset += bytes;
      return uint82;
    }
    const uint8 = new Uint8Array(this.data.subarray(start, start + bytes));
    this.offset += bytes;
    return uint8;
  }
  /**
   * Read from the provided offset and return the value.
   * @param {number} bytes The number of bytes to read.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {Uint8Array} The UInt8 value at the current offset.
   */
  peek(bytes, offset = 0, littleEndian2 = false) {
    if (!this.availableAt(bytes, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + ${bytes}`);
    }
    if (littleEndian2 && bytes > 1) {
      const uint8 = new Uint8Array(bytes);
      for (let i = 0; i < bytes; i++) {
        uint8[i] = this.data[offset + bytes - 1 - i];
      }
      return uint8;
    }
    return new Uint8Array(this.data.subarray(offset, offset + bytes));
  }
  /**
   * Read the bits from the bytes from the provided offset and return the value.
   * Bits are numbered from the most significant bit. Requests extending past bit 7
   * are zero-filled on the right, preserving the existing single-byte behavior.
   * @param {number} position The bit position to read, 0 to 7.
   * @param {number} [length] The number of bits to read, 1 to 8, default is 1.
   * @param {number} [offset] The offset to read from, default is 0.
   * @returns {number} The value at the provided bit position of a provided length at the provided offset.
   * @throws {Error} peekBit position is invalid: ${position}, must be an Integer between 0 and 7
   * @throws {Error} `peekBit length is invalid: ${length}, must be an Integer between 1 and 8
   */
  peekBit(position, length = 1, offset = 0) {
    if (Number.isNaN(position) || !Number.isInteger(position) || position < 0 || position > 7) {
      throw new Error(`peekBit position is invalid: ${position}, must be an Integer between 0 and 7`);
    }
    if (Number.isNaN(length) || !Number.isInteger(length) || length < 1 || length > 8) {
      throw new Error(`peekBit length is invalid: ${length}, must be an Integer between 1 and 8`);
    }
    const value = this.peekUInt8(offset);
    return (value << position & 255) >>> 8 - length;
  }
  /**
   * Read from the current offset and return the value.
   * @returns {number} The Int8 value at the current offset.
   */
  readInt8() {
    if (!this.available(1, false)) {
      throw new underflow_error_default("Insufficient Bytes: 1");
    }
    const v = this.#view.getInt8(this.offset);
    this.offset += 1;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @returns {number} The Int8 value at the current offset.
   */
  peekInt8(offset = 0) {
    if (!this.availableAt(1, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 1`);
    }
    return this.#view.getInt8(offset);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt16 value at the current offset.
   */
  readUInt16(littleEndian2 = false) {
    if (!this.available(2, false)) {
      throw new underflow_error_default("Insufficient Bytes: 2");
    }
    const v = this.#view.getUint16(this.offset, littleEndian2);
    this.offset += 2;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int8 value at the current offset.
   */
  peekUInt16(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(2, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 2`);
    }
    return this.#view.getUint16(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int16 value at the current offset.
   */
  readInt16(littleEndian2 = false) {
    if (!this.available(2, false)) {
      throw new underflow_error_default("Insufficient Bytes: 2");
    }
    const v = this.#view.getInt16(this.offset, littleEndian2);
    this.offset += 2;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int16 value at the current offset.
   */
  peekInt16(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(2, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 2`);
    }
    return this.#view.getInt16(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt24 value at the current offset.
   */
  readUInt24(littleEndian2 = false) {
    if (!this.available(3, false)) {
      throw new underflow_error_default("Insufficient Bytes: 3");
    }
    const { offset } = this;
    const { data } = this;
    const value = littleEndian2 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
    this.offset += 3;
    return value;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt24 value at the current offset.
   */
  peekUInt24(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(3, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 3`);
    }
    const { data } = this;
    const value = littleEndian2 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
    return value;
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int24 value at the current offset.
   */
  readInt24(littleEndian2 = false) {
    if (!this.available(3, false)) {
      throw new underflow_error_default("Insufficient Bytes: 3");
    }
    const { offset } = this;
    const { data } = this;
    const value = littleEndian2 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
    this.offset += 3;
    return value << 8 >> 8;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int24 value at the current offset.
   */
  peekInt24(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(3, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 3`);
    }
    const { data } = this;
    const value = littleEndian2 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
    return value << 8 >> 8;
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt32 value at the current offset.
   */
  readUInt32(littleEndian2 = false) {
    if (!this.available(4, false)) {
      throw new underflow_error_default("Insufficient Bytes: 4");
    }
    const v = this.#view.getUint32(this.offset, littleEndian2);
    this.offset += 4;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt32 value at the current offset.
   */
  peekUInt32(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(4, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
    }
    return this.#view.getUint32(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int32 value at the current offset.
   */
  readInt32(littleEndian2 = false) {
    if (!this.available(4, false)) {
      throw new underflow_error_default("Insufficient Bytes: 4");
    }
    const v = this.#view.getInt32(this.offset, littleEndian2);
    this.offset += 4;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int32 value at the current offset.
   */
  peekInt32(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(4, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
    }
    return this.#view.getInt32(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float32 value at the current offset.
   */
  readFloat32(littleEndian2 = false) {
    if (!this.available(4, false)) {
      throw new underflow_error_default("Insufficient Bytes: 4");
    }
    const v = this.#view.getFloat32(this.offset, littleEndian2);
    this.offset += 4;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float32 value at the current offset.
   */
  peekFloat32(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(4, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
    }
    return this.#view.getFloat32(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the Turbo Pascal 48 bit extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float48 value at the current offset.
   */
  readFloat48(littleEndian2 = false) {
    const uint8 = this.read(6, !littleEndian2);
    return float48(uint8);
  }
  /**
   * Read from the specified offset without advancing the offsets and return the Turbo Pascal 48 bit extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float48 value at the specified offset.
   */
  peekFloat48(offset = 0, littleEndian2 = false) {
    const uint8 = this.peek(6, offset, !littleEndian2);
    return float48(uint8);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float64 value at the current offset.
   */
  readFloat64(littleEndian2 = false) {
    if (!this.available(8, false)) {
      throw new underflow_error_default("Insufficient Bytes: 8");
    }
    const v = this.#view.getFloat64(this.offset, littleEndian2);
    this.offset += 8;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float64 value at the current offset.
   */
  peekFloat64(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(8, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 8`);
    }
    return this.#view.getFloat64(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the IEEE 80 bit extended float value.
   * @param {boolean} [littleEndian] Reverse the input bytes before conversion, defaults to system value, default is the current nativeEndian value.
   * This legacy flag is retained for compatibility; use readFloatIEEE754 / peekFloatIEEE754 for conventional input-endianness semantics.
   * @returns {number} The Float80 value at the current offset.
   */
  readFloat80(littleEndian2 = this.nativeEndian) {
    const uint8 = this.read(10, littleEndian2);
    return float80(uint8);
  }
  /**
   * Read from the specified offset without advancing the offsets and return the IEEE 80 bit extended float value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Reverse the input bytes before conversion, defaults to system value, default is the current nativeEndian value.
   * This legacy flag is retained for compatibility; use readFloatIEEE754 / peekFloatIEEE754 for conventional input-endianness semantics.
   * @returns {number} The Float80 value at the current offset.
   */
  peekFloat80(offset = 0, littleEndian2 = this.nativeEndian) {
    const uint8 = this.peek(10, offset, littleEndian2);
    return float80(uint8);
  }
  /**
   * Read from the current offset and return the IEEE 754 extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The IEEE 754 extended float value at the current offset.
   */
  readFloatIEEE754(littleEndian2 = false) {
    const uint8 = this.read(10, littleEndian2);
    return convertFromIeeeExtended(uint8);
  }
  /**
   * Peek from the specified offset without advancing the offsets and return the IEEE 754 extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The IEEE 754 extended float value at the specified offset.
   */
  peekFloatIEEE754(offset = 0, littleEndian2 = false) {
    const uint8 = this.peek(10, offset, littleEndian2);
    return convertFromIeeeExtended(uint8);
  }
  /**
   * Read from the current offset and return the value as a DataBuffer.
   * @param {number} length The number of bytes to read.
   * @returns {DataBuffer} The requested number of bytes as a DataBuffer.
   */
  readBuffer(length) {
    if (!this.available(length, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${length}`);
    }
    const chunk = new _DataBuffer(new Uint8Array(this.data.subarray(this.offset, this.offset + length)));
    this.offset += length;
    return chunk;
  }
  /**
   * Read from the specified offset and return the value as a DataBuffer.
   * @param {number} offset The offset to read from.
   * @param {number} length The number of bytes to read.
   * @returns {DataBuffer} The requested number of bytes as a DataBuffer.
   */
  peekBuffer(offset, length) {
    if (!this.availableAt(length, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + ${length}`);
    }
    return new _DataBuffer(new Uint8Array(this.data.subarray(offset, offset + length)));
  }
  /**
   * Read from the current offset for a given length and return the value as a string.
   * @param {number|null} [length] The number of bytes to read; omitted reads the remainder, null reads through a null terminator, and zero reads nothing.
   * @param {string} [encoding] The encoding of the string, default is `ascii`.
   * @returns {string} The read value as a string.
   */
  readString(length, encoding = "ascii") {
    debug("readString:", { length, encoding });
    return this.decodeString(this.offset, length, encoding, true);
  }
  /**
   * Read from the specified offset for a given length and return the value as a string.
   * @param {number} offset The offset to read from.
   * @param {number|null} [length] The number of bytes to read; omitted reads the remainder, null reads through a null terminator, and zero reads nothing.
   * @param {string} [encoding] The encoding of the string, default is `ascii`.
   * @returns {string} The read value as a string.
   */
  peekString(offset, length, encoding = "ascii") {
    debug("peekString:", { offset, length, encoding });
    return this.decodeString(offset, length, encoding, false);
  }
  /**
   * Read from the specified offset for a given length and return the value as a string in a specified encoding, and optionally advance the offsets.
   * Supported Encodings: ascii / latin1, utf8 / utf-8, utf16-be, utf16be, utf16le, utf16-le, utf16bom, utf16-bom
   * Encoding names are case-insensitive. Malformed UTF-8 is replaced with U+FFFD without
   * consuming bytes outside the field; malformed UTF-16 retains the existing error behavior.
   * A failed decode does not move the cursor. A successful advancing decode ends at the supplied offset plus consumed bytes.
   * @private
   * @param {number} offset The offset to read from.
   * @param {number|null|undefined} length The number of bytes to read, if not defined it is the remaining bytes in the buffer. If NULL a null terminated string will be read.
   * @param {string} encoding The encoding of the string.
   * @param {boolean} [advance] Flag to optionally advance the offsets, default is false.
   * @returns {string} The read value as a string.
   */
  decodeString(offset, length, encoding, advance = false) {
    debug("decodeString:", { offset, length, encoding, advance });
    encoding = encoding.toLowerCase();
    if (length === null) {
      return this.decodeNullTerminatedString(offset, encoding, advance);
    }
    if (length === void 0) {
      length = this.length - offset;
    }
    if (!this.availableAt(length, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + ${length}`);
    }
    const end = offset + length;
    const { data } = this;
    const codes = [];
    const chunks = [];
    switch (encoding) {
      case "ascii":
      case "latin1": {
        while (offset < end) {
          if (codes.length >= 16384) {
            chunks.push(String.fromCharCode(...codes));
            codes.length = 0;
          }
          const character = data[offset++];
          codes.push(character);
        }
        break;
      }
      case "utf8":
      case "utf-8": {
        while (offset < end) {
          if (codes.length >= 16384) {
            chunks.push(String.fromCharCode(...codes));
            codes.length = 0;
          }
          const b1 = data[offset++];
          let needed = 0;
          let point = 0;
          let lower = 128;
          let upper = 191;
          if (b1 < 128) {
            codes.push(b1);
            continue;
          } else if (b1 >= 194 && b1 <= 223) {
            needed = 1;
            point = b1 & 31;
          } else if (b1 >= 224 && b1 <= 239) {
            needed = 2;
            point = b1 & 15;
            if (b1 === 224) {
              lower = 160;
            }
            if (b1 === 237) {
              upper = 159;
            }
          } else if (b1 >= 240 && b1 <= 244) {
            needed = 3;
            point = b1 & 7;
            if (b1 === 240) {
              lower = 144;
            }
            if (b1 === 244) {
              upper = 143;
            }
          } else {
            codes.push(65533);
            continue;
          }
          let valid = true;
          for (let i = 0; i < needed; i++) {
            if (offset >= end || data[offset] < lower || data[offset] > upper) {
              valid = false;
              break;
            }
            point = point << 6 | data[offset++] & 63;
            lower = 128;
            upper = 191;
          }
          if (!valid) {
            codes.push(65533);
          } else if (point < 65536) {
            codes.push(point);
          } else {
            const pt = point - 65536;
            codes.push(55296 + (pt >> 10), 56320 + (pt & 1023));
          }
        }
        break;
      }
      case "utf16-be":
      case "utf16be":
      case "utf16le":
      case "utf16-le":
      case "utf16bom":
      case "utf16-bom": {
        let littleEndian2;
        switch (encoding) {
          case "utf16be":
          case "utf16-be": {
            littleEndian2 = false;
            break;
          }
          case "utf16le":
          case "utf16-le": {
            littleEndian2 = true;
            break;
          }
          case "utf16bom":
          case "utf16-bom":
          default: {
            littleEndian2 = false;
            if (end - offset >= 2) {
              const bom = data[offset] << 8 | data[offset + 1];
              if (bom === 65279 || bom === 65534) {
                littleEndian2 = bom === 65534;
                offset += 2;
              }
            }
            break;
          }
        }
        let w1 = 0;
        while (offset < end) {
          if (codes.length >= 16384) {
            chunks.push(String.fromCharCode(...codes));
            codes.length = 0;
          }
          if (end - offset < 2) {
            throw new Error("Invalid utf16 sequence.");
          }
          w1 = littleEndian2 ? data[offset] | data[offset + 1] << 8 : data[offset] << 8 | data[offset + 1];
          offset += 2;
          if (w1 < 55296 || w1 > 57343) {
            codes.push(w1);
          } else {
            if (w1 > 56319 || end - offset < 2) {
              throw new Error("Invalid utf16 sequence.");
            }
            const w2 = littleEndian2 ? data[offset] | data[offset + 1] << 8 : data[offset] << 8 | data[offset + 1];
            if (w2 < 56320 || w2 > 57343) {
              throw new Error("Invalid utf16 sequence.");
            }
            codes.push(w1, w2);
            offset += 2;
          }
        }
        break;
      }
      default: {
        throw new Error(`Unknown Encoding: ${encoding}`);
      }
    }
    const result = chunks.length ? chunks.join("") + String.fromCharCode(...codes) : String.fromCharCode(...codes);
    if (advance) {
      this.offset = end;
    }
    return result;
  }
  /**
   * Read a null-terminated string from the current offset and advance the offset.
   * A null-terminated string is a sequence of bytes ending with a null byte (0x00).
   * @param {string} [encoding] The encoding of the string, default is `ascii`.
   * @param {number} [nullValue] The byte value that terminates the string, default is 0x00.
   * @returns {string} The read value as a string (without the null terminator).
   */
  readNullTerminatedString(encoding = "ascii", nullValue = 0) {
    debug("readNullTerminatedString:", { encoding, nullValue });
    const result = this.decodeNullTerminatedString(this.offset, encoding, true, nullValue);
    return result;
  }
  /**
   * Read a null-terminated string from the specified offset without advancing the offset.
   * A null-terminated string is a sequence of bytes ending with a null byte (0x00).
   * @param {number} offset The offset to read from.
   * @param {string} [encoding] The encoding of the string, default is `ascii`.
   * @param {number} [nullValue] The byte value that terminates the string, default is 0x00.
   * @returns {string} The read value as a string (without the null terminator).
   */
  peekNullTerminatedString(offset, encoding = "ascii", nullValue = 0) {
    debug("peekNullTerminatedString:", { offset, encoding, nullValue });
    const result = this.decodeNullTerminatedString(offset, encoding, false, nullValue);
    return result;
  }
  /**
   * Decode a null-terminated string from the specified offset.
   * Reads bytes until a null byte (0x00) is encountered. For UTF-16, a terminator is two
   * copies of nullValue at a code-unit boundary. Without a terminator, reads to the end of data.
   * Uses the same encodings and Unicode validation as decodeString.
   * @private
   * @param offset The offset to read from.
   * @param encoding The encoding of the string.
   * @param advance Flag to optionally advance the offsets.
   * @param nullValue The byte value that terminates the string, default is 0x00.
   * @returns The read value as a string (without the null terminator).
   */
  decodeNullTerminatedString(offset, encoding, advance, nullValue = 0) {
    debug("decodeNullTerminatedString:", { offset, encoding, advance, nullValue });
    encoding = encoding.toLowerCase();
    if (!this.availableAt(0, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 0`);
    }
    if (!Number.isInteger(nullValue) || nullValue < 0 || nullValue > 255) {
      throw new RangeError(`Invalid null value: ${nullValue}`);
    }
    const start = offset;
    const { data } = this;
    const { length } = data;
    let end = length;
    switch (encoding) {
      case "utf8":
      case "utf-8": {
        const terminator = data.indexOf(nullValue, offset);
        if (terminator !== -1) {
          end = terminator;
          offset = terminator + 1;
        } else {
          offset = length;
        }
        break;
      }
      case "utf16-be":
      case "utf16be":
      case "utf16-le":
      case "utf16le":
      case "utf16bom":
      case "utf16-bom": {
        while (offset < length - 1) {
          const b1 = data[offset];
          const b2 = data[offset + 1];
          if (b1 === nullValue && b2 === nullValue) {
            end = offset;
            offset += 2;
            break;
          }
          offset += 2;
        }
        if (end === length) {
          offset = length;
        }
        break;
      }
      case "ascii":
      case "latin1": {
        const terminator = data.indexOf(nullValue, offset);
        if (terminator !== -1) {
          end = terminator;
          offset = terminator + 1;
        } else {
          offset = length;
        }
        break;
      }
      default: {
        throw new Error(`Unknown Encoding: ${encoding}`);
      }
    }
    const result = this.decodeString(start, end - start, encoding, false);
    if (advance) {
      this.offset = offset;
    }
    return result;
  }
  /**
   * Resets the instance offsets to 0.
   */
  reset() {
    debug("reset");
    this.offset = 0;
  }
  /**
   * Writes a single 8 bit byte.
   * @param {number} data The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
   */
  writeUInt8(data, offset = this.offset, advance = true) {
    debug("writeUInt8:", { data, offset, advance });
    this.#validateWrite(1, offset);
    const buffer = this.buffer;
    buffer[offset] = data;
    if (advance) {
      this.offset = offset + 1;
    }
  }
  /**
   * Writes an unsigned 16 bit value, 2 bytes.
   * @param {number} data The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
   * @param {boolean} [littleEndian] Endianness of the write order, little Endian when `true`, default is big Endian `false`.
   */
  writeUInt16(data, offset = this.offset, advance = true, littleEndian2 = false) {
    debug("writeUInt16:", { data, offset, advance, littleEndian: littleEndian2 });
    this.#validateWrite(2, offset);
    const buffer = this.buffer;
    if (littleEndian2) {
      buffer[offset] = data & 255;
      buffer[offset + 1] = (data & 65280) >> 8;
    } else {
      buffer[offset] = (data & 65280) >> 8;
      buffer[offset + 1] = data & 255;
    }
    if (advance) {
      this.offset = offset + 2;
    }
  }
  /**
   * Writes an unsigned 24 bit value, 3 bytes.
   * @param {number} data The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
   * @param {boolean} [littleEndian] Endianness of the write order, little Endian when `true`, default is big Endian `false`.
   */
  writeUInt24(data, offset = this.offset, advance = true, littleEndian2 = false) {
    debug("writeUInt24:", { data, offset, advance, littleEndian: littleEndian2 });
    this.#validateWrite(3, offset);
    const buffer = this.buffer;
    if (littleEndian2) {
      buffer[offset] = data & 255;
      buffer[offset + 1] = (data & 65280) >> 8;
      buffer[offset + 2] = (data & 16711680) >> 16;
    } else {
      buffer[offset] = (data & 16711680) >> 16;
      buffer[offset + 1] = (data & 65280) >> 8;
      buffer[offset + 2] = data & 255;
    }
    if (advance) {
      this.offset = offset + 3;
    }
  }
  /**
   * Writes an unsigned 32 bit value, 4 bytes.
   * @param {number} data The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
   * @param {boolean} [littleEndian] Endianness of the write order, little Endian when `true`, default is big Endian `false`.
   */
  writeUInt32(data, offset = this.offset, advance = true, littleEndian2 = false) {
    debug("writeUInt32:", { data, offset, advance, littleEndian: littleEndian2 });
    this.#validateWrite(4, offset);
    const buffer = this.buffer;
    if (littleEndian2) {
      buffer[offset] = data & 255;
      buffer[offset + 1] = (data & 65280) >> 8;
      buffer[offset + 2] = (data & 16711680) >> 16;
      buffer[offset + 3] = data >>> 24;
    } else {
      buffer[offset] = data >>> 24;
      buffer[offset + 1] = (data & 16711680) >> 16;
      buffer[offset + 2] = (data & 65280) >> 8;
      buffer[offset + 3] = data & 255;
    }
    if (advance) {
      this.offset = offset + 4;
    }
  }
  /**
   * Write a series of bytes.
   * Wider typed arrays retain the existing element-wise behavior: one staged value per element,
   * converted to a byte by commit(), not the constructor's raw-memory interpretation.
   * @param {number[]|Int8Array|Int16Array|Int32Array|Uint8Array|Uint16Array|Uint32Array} data The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
   */
  writeBytes(data, offset = this.offset, advance = true) {
    debug("writeBytes:", { data, offset, advance });
    const { length } = data;
    this.#validateWrite(length, offset);
    if (length > 0) {
      const buffer = this.buffer;
      const source = data === buffer ? buffer.slice() : data;
      for (let i = 0; i < length; i++) {
        buffer[offset + i] = source[i];
      }
    }
    if (advance) {
      this.offset = offset + length;
    }
  }
  /**
   * Write a string as a given encoding.
   *
   * Valid encodings are: 'ascii' aka 'latin1', 'utf8' / 'utf-8', 'utf16be' / 'utf16-be', 'utf16le' / 'utf16-le', 'utf16bom' / 'utf16-bom'.
   * Names are case-insensitive. BOM encodings write a big-endian BOM before the UTF-16 data.
   * UTF-8 replaces unpaired surrogates with U+FFFD; UTF-16 retains the original code units.
   *
   * For UTF-8:
   * Up to 4 bytes per character can be used. The fewest number of bytes possible is used.
   * Characters up to U+007F are encoded with a single byte.
   * For multibyte sequences, the number of leading 1 bits in the first byte gives the number of bytes for the character. The rest of the bits of the first byte can be used to encode bits of the character.
   * The continuation bytes begin with 10, and the other 6 bits encode bits of the character.
   *
   * UTF-8 conversion interpreted from https://stackoverflow.com/posts/18729931/revisions
   * @param {string} string The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {string} [encoding] The encoding of the string, defailt is `ascii`.
   * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
   */
  writeString(string, offset = this.offset, encoding = "ascii", advance = true) {
    debug("writeString:", { string, offset, encoding, advance });
    this.#validateWrite(0, offset);
    encoding = encoding.toLowerCase();
    const data = [];
    switch (encoding) {
      case "ascii":
      case "latin1": {
        for (let i = 0; i < string.length; i++) {
          data.push(string.charCodeAt(i) & 255);
        }
        break;
      }
      case "utf8":
      case "utf-8": {
        for (let i = 0; i < string.length; i++) {
          let charcode = string.charCodeAt(i);
          if (charcode < 128) {
            data.push(charcode);
          } else if (charcode < 2048) {
            data.push(192 | charcode >> 6, 128 | charcode & 63);
          } else if (charcode < 55296 || charcode >= 57344) {
            data.push(224 | charcode >> 12, 128 | charcode >> 6 & 63, 128 | charcode & 63);
          } else {
            const next = string.charCodeAt(i + 1);
            if (charcode > 56319 || !(next >= 56320 && next <= 57343)) {
              data.push(239, 191, 189);
              continue;
            }
            i++;
            charcode = 65536 + ((charcode & 1023) << 10 | string.charCodeAt(i) & 1023);
            data.push(240 | charcode >> 18, 128 | charcode >> 12 & 63, 128 | charcode >> 6 & 63, 128 | charcode & 63);
          }
        }
        break;
      }
      case "utf16be":
      case "utf16-be":
      case "utf16le":
      case "utf16-le":
      case "utf16bom":
      case "utf16-bom": {
        const littleEndian2 = encoding === "utf16le" || encoding === "utf16-le";
        if (encoding === "utf16bom" || encoding === "utf16-bom") {
          data.push(254, 255);
        }
        for (let i = 0; i < string.length; i++) {
          const charcode = string.charCodeAt(i);
          if (littleEndian2) {
            data.push(charcode & 255, charcode / 256 >>> 0);
          } else {
            data.push(charcode / 256 >>> 0, charcode & 255);
          }
        }
        break;
      }
      default: {
        throw new Error(`Unknown Encoding: ${encoding}`);
      }
    }
    debug("writeString: data", data);
    this.writeBytes(data, offset, advance);
  }
  /**
   * Convert a write mode file into a read mode file.
   */
  commit() {
    debug("commit: converting to read mode file");
    this.data = new Uint8Array(this.buffer);
    this.lengthInBytes = this.data.length;
    this.#dataView = null;
    this.#viewData = null;
    this.#viewLength = -1;
    this._buffer = null;
    this.writing = false;
  }
};
var data_buffer_default = DataBuffer;

// node_modules/@uttori/data-tools/dist/data-hash-crc32.js
var CRC32_POLYNOMIAL = 3988292384;
var CRC32C_POLYNOMIAL = 2197175160;
var reflectedTable = (polynomial) => Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? polynomial ^ crc >>> 1 : crc >>> 1;
  }
  return crc >>> 0;
});
var sliceTable = (table) => {
  const slices = [Uint32Array.from(table)];
  for (let width = 1; width < 8; width++) {
    const previous = slices[width - 1];
    slices.push(Uint32Array.from(previous, (crc) => crc >>> 8 ^ table[crc & 255]));
  }
  return [slices[0], slices[1], slices[2], slices[3], slices[4], slices[5], slices[6], slices[7]];
};
var CRC32_TABLE = /* @__PURE__ */ reflectedTable(CRC32_POLYNOMIAL);
var CRC32C_TABLE = /* @__PURE__ */ reflectedTable(CRC32C_POLYNOMIAL);
var crc32Slices = /* @__PURE__ */ sliceTable(CRC32_TABLE);
var crc32cSlices = /* @__PURE__ */ sliceTable(CRC32C_TABLE);
var [i0, i1, i2, i3, i4, i5, i6, i7] = crc32Slices;
var [c0, c1, c2, c3, c4, c5, c6, c7] = crc32cSlices;
var computeBytes = (bytes) => {
  let crc = -1;
  let index = 0;
  const length = bytes.length;
  const blockEnd = length - 7;
  for (; index < blockEnd; index += 8) {
    const mixed = crc ^ (bytes[index] | bytes[index + 1] << 8 | bytes[index + 2] << 16 | bytes[index + 3] << 24);
    crc = i7[mixed & 255] ^ i6[mixed >>> 8 & 255] ^ i5[mixed >>> 16 & 255] ^ i4[mixed >>> 24] ^ i3[bytes[index + 4]] ^ i2[bytes[index + 5]] ^ i1[bytes[index + 6]] ^ i0[bytes[index + 7]];
  }
  for (; index < length; index++) {
    crc = crc >>> 8 ^ i0[(crc ^ bytes[index]) & 255];
  }
  return ~crc >>> 0;
};

// node_modules/@uttori/data-tools/dist/image/bitmap-text.js
function freezeGlyphs() {
  return Object.freeze(Object.fromEntries(Object.entries({
    " ": [0, 0, 0, 0, 0, 0, 0],
    A: [14, 17, 17, 31, 17, 17, 17],
    B: [30, 17, 17, 30, 17, 17, 30],
    C: [14, 17, 16, 16, 16, 17, 14],
    D: [30, 17, 17, 17, 17, 17, 30],
    E: [31, 16, 16, 30, 16, 16, 31],
    F: [31, 16, 16, 30, 16, 16, 16],
    G: [14, 17, 16, 23, 17, 17, 15],
    H: [17, 17, 17, 31, 17, 17, 17],
    I: [14, 4, 4, 4, 4, 4, 14],
    J: [7, 2, 2, 2, 2, 18, 12],
    K: [17, 18, 20, 24, 20, 18, 17],
    L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17],
    N: [17, 25, 21, 19, 17, 17, 17],
    O: [14, 17, 17, 17, 17, 17, 14],
    P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13],
    R: [30, 17, 17, 30, 20, 18, 17],
    S: [15, 16, 16, 14, 1, 1, 30],
    T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14],
    V: [17, 17, 17, 17, 17, 10, 4],
    W: [17, 17, 17, 21, 21, 27, 17],
    X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 10, 4, 4, 4, 4],
    Z: [31, 1, 2, 4, 8, 16, 31],
    0: [14, 17, 19, 21, 25, 17, 14],
    1: [4, 12, 4, 4, 4, 4, 14],
    2: [14, 17, 1, 2, 4, 8, 31],
    3: [30, 1, 1, 14, 1, 1, 30],
    4: [2, 6, 10, 18, 31, 2, 2],
    5: [31, 16, 16, 30, 1, 1, 30],
    6: [14, 16, 16, 30, 17, 17, 14],
    7: [31, 1, 2, 4, 8, 8, 8],
    8: [14, 17, 17, 14, 17, 17, 14],
    9: [14, 17, 17, 15, 1, 1, 14],
    ".": [0, 0, 0, 0, 0, 12, 12],
    ",": [0, 0, 0, 0, 4, 4, 8],
    ":": [0, 12, 12, 0, 12, 12, 0],
    ";": [0, 12, 12, 0, 4, 4, 8],
    "!": [4, 4, 4, 4, 4, 0, 4],
    "?": [14, 17, 1, 2, 4, 0, 4],
    "-": [0, 0, 0, 31, 0, 0, 0],
    _: [0, 0, 0, 0, 0, 0, 31],
    "+": [0, 4, 4, 31, 4, 4, 0],
    "=": [0, 0, 31, 0, 31, 0, 0],
    "/": [1, 2, 2, 4, 8, 8, 16],
    "\\": [16, 8, 8, 4, 2, 2, 1],
    "(": [2, 4, 8, 8, 8, 4, 2],
    ")": [8, 4, 2, 2, 2, 4, 8],
    "[": [14, 8, 8, 8, 8, 8, 14],
    "]": [14, 2, 2, 2, 2, 2, 14],
    "<": [1, 2, 4, 8, 4, 2, 1],
    ">": [16, 8, 4, 2, 4, 8, 16],
    "#": [10, 10, 31, 10, 31, 10, 10],
    "%": [25, 25, 2, 4, 8, 19, 19],
    "*": [0, 21, 14, 31, 14, 21, 0],
    "|": [4, 4, 4, 4, 4, 4, 4],
    "'": [4, 4, 8, 0, 0, 0, 0],
    '"': [10, 10, 20, 0, 0, 0, 0],
    "@": [14, 17, 23, 21, 23, 16, 14],
    "&": [12, 18, 20, 8, 21, 18, 13],
    $: [4, 15, 20, 14, 5, 30, 4],
    "^": [4, 10, 17, 0, 0, 0, 0],
    "~": [0, 0, 8, 21, 2, 0, 0],
    "`": [8, 4, 2, 0, 0, 0, 0],
    "{": [2, 4, 4, 8, 4, 4, 2],
    "}": [8, 4, 4, 2, 4, 4, 8]
  }).map(([key, rows]) => [key, Object.freeze(rows)])));
}
var GLYPHS = /* @__PURE__ */ freezeGlyphs();
function layout(text, options = {}) {
  if (typeof text !== "string") {
    throw new TypeError("Caption must be a string.");
  }
  if (text.length > 4096) {
    throw new RangeError("Caption exceeds 4096 UTF-16 code units.");
  }
  const scale = options.scale ?? 1;
  if (!Number.isSafeInteger(scale) || scale < 1 || scale > 64) {
    throw new RangeError("Text scale must be an integer in [1, 64].");
  }
  const lines = text.length ? text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n").map((line) => Array.from(line)) : [];
  const maxColumns = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    lines,
    scale,
    metrics: {
      width: maxColumns ? (maxColumns * 6 - 1) * scale : 0,
      height: lines.length ? (lines.length * 8 - 1) * scale : 0,
      advanceX: (lines.at(-1)?.length ?? 0) * 6 * scale,
      advanceY: Math.max(0, lines.length - 1) * 8 * scale,
      lineHeight: 8 * scale,
      baseline: 7 * scale,
      lines: lines.length
    }
  };
}
var BitmapText = /* @__PURE__ */ Object.freeze({
  glyphWidth: 5,
  glyphHeight: 7,
  advance: 6,
  lineHeight: 8,
  measure(text, options = {}) {
    return layout(text, options).metrics;
  }
});
function drawBitmapText(surface, text, x, y, color, options) {
  if (!Number.isSafeInteger(x) || x < -2147483647 || x > 2147483647) {
    throw new RangeError("Text x must be an integer in [-2147483647, 2147483647].");
  }
  if (!Number.isSafeInteger(y) || y < -2147483647 || y > 2147483647) {
    throw new RangeError("Text y must be an integer in [-2147483647, 2147483647].");
  }
  const { lines, scale, metrics } = layout(text, options);
  for (let line = 0; line < lines.length; line++) {
    for (let column = 0; column < lines[line].length; column++) {
      let character = lines[line][column];
      const code = character.codePointAt(0);
      if (code && code >= 97 && code <= 122) {
        character = String.fromCharCode(code - 32);
      }
      const glyph = GLYPHS[character] ?? GLYPHS["?"];
      for (let row = 0; row < 7; row++) {
        for (let cx = 0; cx < 5; ) {
          if (!(glyph[row] & 16 >>> cx)) {
            cx++;
            continue;
          }
          const start = cx++;
          while (cx < 5 && glyph[row] & 16 >>> cx) {
            cx++;
          }
          surface.fill(color, {
            x: x + (column * 6 + start) * scale,
            y: y + (line * 8 + row) * scale,
            width: (cx - start) * scale,
            height: scale
          });
        }
      }
    }
  }
  return metrics;
}

// node_modules/@uttori/data-tools/dist/image/rgba-surface.js
var DEFAULT_MAX_PIXELS = 4 * 1024 * 1024;
function colorRGBA(color) {
  if (!Array.isArray(color) && !(color instanceof Uint8Array) || color.length !== 4) {
    throw new TypeError("Color must have four RGBA8 components.");
  }
  for (const component of color) {
    if (!Number.isSafeInteger(component) || component < 0 || component > 255) {
      throw new RangeError(`RGBA component must be an integer in [0, 255].`);
    }
  }
  return color;
}
function validateRGBA(image, maxPixels = DEFAULT_MAX_PIXELS) {
  if (!Number.isSafeInteger(image.width) || image.width < 1 || image.width > 2147483647) {
    throw new RangeError(`width must be an integer in [1, 0x7fffffff].`);
  }
  if (!Number.isSafeInteger(image.height) || image.height < 1 || image.height > 2147483647) {
    throw new RangeError(`height must be an integer in [1, 0x7fffffff].`);
  }
  if (!Number.isSafeInteger(maxPixels) || maxPixels < 1 || maxPixels > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`maxPixels must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
  }
  if (!Number.isSafeInteger(image.width * image.height) || image.width * image.height > maxPixels) {
    throw new RangeError(`Image dimensions ${image.width}x${image.height} exceed the pixel limit ${maxPixels}.`);
  }
  if (!(image.rgba instanceof Uint8Array) || image.rgba.length !== image.width * image.height * 4) {
    throw new TypeError(`RGBA must be an exact ${image.width}x${image.height}x4 Uint8Array.`);
  }
}
function littleEndian() {
  return new Uint8Array(new Uint32Array([16909060]).buffer)[0] === 4;
}
var LITTLE_ENDIAN = /* @__PURE__ */ littleEndian();
var wordView = (bytes) => bytes.byteOffset % 4 === 0 ? new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4) : void 0;
function blend(destination, offset, r, g, b, a) {
  if (a === 0) {
    return;
  }
  if (a === 255) {
    destination[offset] = r;
    destination[offset + 1] = g;
    destination[offset + 2] = b;
    destination[offset + 3] = a;
    return;
  }
  const da = destination[offset + 3], inverse = 255 - a;
  const denominator = a * 255 + da * inverse;
  destination[offset] = Math.round((r * a * 255 + destination[offset] * da * inverse) / denominator);
  destination[offset + 1] = Math.round((g * a * 255 + destination[offset + 1] * da * inverse) / denominator);
  destination[offset + 2] = Math.round((b * a * 255 + destination[offset + 2] * da * inverse) / denominator);
  destination[offset + 3] = Math.round(denominator / 255);
}
var RgbaSurface = class _RgbaSurface {
  kind;
  width;
  height;
  rgba;
  maxPixels;
  constructor(width, height, rgba, options = {}) {
    const maxPixels = options.maxPixels ?? DEFAULT_MAX_PIXELS;
    if (!Number.isSafeInteger(width) || width < 1 || width > 2147483647) {
      throw new RangeError("Width must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(height) || height < 1 || height > 2147483647) {
      throw new RangeError("Height must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(maxPixels) || maxPixels < 1 || maxPixels > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(`Pixel limit must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
    }
    if (!Number.isSafeInteger(width * height) || width * height > maxPixels) {
      throw new RangeError(`Image dimensions ${width}\xD7${height} exceed the pixel limit ${maxPixels}.`);
    }
    if (rgba !== void 0) {
      validateRGBA({ width, height, rgba }, maxPixels);
    }
    let bytes;
    if (rgba === void 0) {
      bytes = new Uint8Array(width * height * 4);
    } else if (options.copy === false) {
      bytes = rgba;
    } else {
      bytes = Uint8Array.from(rgba);
    }
    this.kind = "rgba-image";
    this.width = width;
    this.height = height;
    this.rgba = bytes;
    this.maxPixels = maxPixels;
    Object.defineProperties(this, {
      kind: { writable: false, configurable: false },
      width: { writable: false, configurable: false },
      height: { writable: false, configurable: false },
      rgba: { writable: false, configurable: false },
      maxPixels: { writable: false, configurable: false }
    });
  }
  static from(image, options) {
    return new _RgbaSurface(image.width, image.height, image.rgba, options);
  }
  static fromIndexed(image, options) {
    const maxPixels = options?.maxPixels ?? DEFAULT_MAX_PIXELS;
    if (!Number.isSafeInteger(image.width) || image.width < 1 || image.width > 2147483647) {
      throw new RangeError("Width must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(image.height) || image.height < 1 || image.height > 2147483647) {
      throw new RangeError("Height must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(maxPixels) || maxPixels < 1 || maxPixels > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(`Pixel limit must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
    }
    if (!Number.isSafeInteger(image.width * image.height) || image.width * image.height > maxPixels) {
      throw new RangeError(`Image dimensions ${image.width}x${image.height} exceed the pixel limit ${maxPixels}.`);
    }
    if (!(image.indexes instanceof Uint8Array) || image.indexes.length !== image.width * image.height) {
      throw new Error("Indexed buffer does not match dimensions.");
    }
    if (!Array.isArray(image.palette)) {
      throw new TypeError("Palette must be an array.");
    }
    if (image.palette.length < 1 || image.palette.length > 256) {
      throw new RangeError("Palette slots must be between 1 and 256.");
    }
    for (const color of image.palette) {
      colorRGBA(color);
    }
    const result = new _RgbaSurface(image.width, image.height, void 0, options);
    for (let i = 0, offset = 0; i < image.indexes.length; i++, offset += 4) {
      const color = image.palette[image.indexes[i]];
      if (!color) {
        throw new Error(`Missing palette slot ${image.indexes[i]}.`);
      }
      result.rgba[offset] = color[0];
      result.rgba[offset + 1] = color[1];
      result.rgba[offset + 2] = color[2];
      result.rgba[offset + 3] = color[3];
    }
    return result;
  }
  clone() {
    return new _RgbaSurface(this.width, this.height, this.rgba, { maxPixels: this.maxPixels });
  }
  /** Copy-mode fill, including RGB under alpha zero. Rectangles are clipped, not resized. */
  fill(color, rect = {}) {
    colorRGBA(color);
    const x = rect.x ?? 0;
    if (!Number.isSafeInteger(x) || x < -2147483647 || x > 2147483647) {
      throw new RangeError("Fill x must be an integer in [-2147483647, 2147483647].");
    }
    const y = rect.y ?? 0;
    if (!Number.isSafeInteger(y) || y < -2147483647 || y > 2147483647) {
      throw new RangeError("Fill y must be an integer in [-2147483647, 2147483647].");
    }
    const width = rect.width ?? this.width;
    if (!Number.isSafeInteger(width) || width < 0 || width > 2147483647) {
      throw new RangeError("Fill width must be an integer in [0, 2147483647].");
    }
    const height = rect.height ?? this.height;
    if (!Number.isSafeInteger(height) || height < 0 || height > 2147483647) {
      throw new RangeError("Fill height must be an integer in [0, 2147483647].");
    }
    const left = Math.max(0, x);
    const top = Math.max(0, y);
    const right = Math.min(this.width, x + width);
    const bottom = Math.min(this.height, y + height);
    if (left >= right || top >= bottom) {
      return this;
    }
    const words = wordView(this.rgba);
    if (words) {
      const value = LITTLE_ENDIAN ? color[0] | color[1] << 8 | color[2] << 16 | color[3] << 24 : color[3] | color[2] << 8 | color[1] << 16 | color[0] << 24;
      for (let row = top; row < bottom; row++) {
        words.fill(value, row * this.width + left, row * this.width + right);
      }
    } else {
      for (let row = top; row < bottom; row++) {
        for (let offset = (row * this.width + left) * 4, end = (row * this.width + right) * 4; offset < end; offset += 4) {
          this.rgba[offset] = color[0];
          this.rgba[offset + 1] = color[1];
          this.rgba[offset + 2] = color[2];
          this.rgba[offset + 3] = color[3];
        }
      }
    }
    return this;
  }
  /** Clip against source and destination. Snapshot aliased buffers before the first write. */
  blit(source, x, y, options = {}) {
    validateRGBA(source, this.maxPixels);
    if (!Number.isSafeInteger(x) || x < -2147483647 || x > 2147483647) {
      throw new RangeError("Blit x must be an integer in [-2147483647, 2147483647].");
    }
    if (!Number.isSafeInteger(y) || y < -2147483647 || y > 2147483647) {
      throw new RangeError("Blit y must be an integer in [-2147483647, 2147483647].");
    }
    const sx = options.sx ?? 0;
    if (!Number.isSafeInteger(sx) || sx < -2147483647 || sx > 2147483647) {
      throw new RangeError("Source x must be an integer in [-2147483647, 2147483647].");
    }
    const sy = options.sy ?? 0;
    if (!Number.isSafeInteger(sy) || sy < -2147483647 || sy > 2147483647) {
      throw new RangeError("Source y must be an integer in [-2147483647, 2147483647].");
    }
    const width = options.width ?? source.width;
    if (!Number.isSafeInteger(width) || width < 0 || width > 2147483647) {
      throw new RangeError("Blit width must be an integer in [0, 2147483647].");
    }
    const height = options.height ?? source.height;
    if (!Number.isSafeInteger(height) || height < 0 || height > 2147483647) {
      throw new RangeError("Blit height must be an integer in [0, 2147483647].");
    }
    const mode = options.mode ?? "copy";
    if (!["copy", "source-over"].includes(mode)) {
      throw new Error("Blit mode must be copy or source-over.");
    }
    const left = Math.max(0, -sx, -x);
    const top = Math.max(0, -sy, -y);
    const right = Math.min(width, source.width - sx, this.width - x);
    const bottom = Math.min(height, source.height - sy, this.height - y);
    if (left >= right || top >= bottom) {
      return this;
    }
    const rowLength = (right - left) * 4;
    const rows = bottom - top;
    let bytes = source.rgba;
    let stride = source.width * 4;
    let start = ((sy + top) * source.width + sx + left) * 4;
    if (bytes.buffer === this.rgba.buffer) {
      const snapshot = new Uint8Array(rows * rowLength);
      for (let row = 0; row < rows; row++) {
        snapshot.set(bytes.subarray(start + row * stride, start + row * stride + rowLength), row * rowLength);
      }
      bytes = snapshot;
      stride = rowLength;
      start = 0;
    }
    for (let row = 0; row < rows; row++) {
      let destination = ((y + top + row) * this.width + x + left) * 4;
      const input = start + row * stride;
      if (mode === "copy") {
        this.rgba.set(bytes.subarray(input, input + rowLength), destination);
      } else {
        for (let i = input; i < input + rowLength; i += 4, destination += 4) {
          blend(this.rgba, destination, bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
        }
      }
    }
    return this;
  }
  /** Strict in-bounds crop; invalid or zero dimensions are errors rather than implicit padding. */
  crop(x, y, width, height) {
    if (!Number.isSafeInteger(x) || x < 0 || x > 2147483647) {
      throw new RangeError("Crop x must be an integer in [0, 2147483647].");
    }
    if (!Number.isSafeInteger(y) || y < 0 || y > 2147483647) {
      throw new RangeError("Crop y must be an integer in [0, 2147483647].");
    }
    if (!Number.isSafeInteger(width) || width < 1 || width > 2147483647) {
      throw new RangeError("Width must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(height) || height < 1 || height > 2147483647) {
      throw new RangeError("Height must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(this.maxPixels) || this.maxPixels < 1 || this.maxPixels > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(`Pixel limit must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
    }
    if (!Number.isSafeInteger(width * height) || width * height > this.maxPixels) {
      throw new RangeError(`Image dimensions ${width}\xD7${height} exceed the pixel limit ${this.maxPixels}.`);
    }
    if (x + width > this.width || y + height > this.height) {
      throw new RangeError("Crop rectangle exceeds surface bounds.");
    }
    return new _RgbaSurface(width, height, void 0, { maxPixels: this.maxPixels }).blit(this, 0, 0, { sx: x, sy: y, width, height });
  }
  /** Flip the surface horizontally or vertically. */
  flip({ horizontal = false, vertical = false } = {}) {
    if (typeof horizontal !== "boolean" || typeof vertical !== "boolean") {
      throw new TypeError("Flip flags must be booleans.");
    }
    const result = new _RgbaSurface(this.width, this.height, void 0, {
      maxPixels: this.maxPixels
    });
    const inputWords = wordView(this.rgba), outputWords = wordView(result.rgba);
    for (let y = 0; y < this.height; y++) {
      const sy = vertical ? this.height - y - 1 : y;
      if (!horizontal) {
        result.rgba.set(this.rgba.subarray(sy * this.width * 4, (sy + 1) * this.width * 4), y * this.width * 4);
      } else {
        for (let x = 0; x < this.width; x++) {
          const input = sy * this.width + this.width - x - 1, output = y * this.width + x;
          if (inputWords && outputWords) {
            outputWords[output] = inputWords[input];
          } else {
            for (let c = 0; c < 4; c++) {
              result.rgba[output * 4 + c] = this.rgba[input * 4 + c];
            }
          }
        }
      }
    }
    return result;
  }
  /** Flip the surface horizontally. */
  flipX() {
    return this.flip({ horizontal: true });
  }
  /** Flip the surface vertically. */
  flipY() {
    return this.flip({ vertical: true });
  }
  /** Nearest neighbor with floor(x * sourceWidth / width), independently on each axis. */
  scaleNearest(width, height) {
    return this._resample(width, height);
  }
  /** Aspect fit with the original preview.ts shared-scale sampling convention. */
  fitNearest(maxEdge, { upscale = false } = {}) {
    if (!Number.isSafeInteger(maxEdge) || maxEdge < 1 || maxEdge > 2147483647) {
      throw new RangeError("Maximum edge must be an integer in [1, 2147483647].");
    }
    if (typeof upscale !== "boolean") {
      throw new TypeError("upscale must be a boolean.");
    }
    const scale = Math.min(upscale ? Infinity : 1, maxEdge / Math.max(this.width, this.height));
    return this._resample(Math.max(1, Math.floor(this.width * scale)), Math.max(1, Math.floor(this.height * scale)), scale);
  }
  _resample(width, height, scale) {
    if (!Number.isSafeInteger(width) || width < 1 || width > 2147483647) {
      throw new RangeError("Width must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(height) || height < 1 || height > 2147483647) {
      throw new RangeError("Height must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(this.maxPixels) || this.maxPixels < 1 || this.maxPixels > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(`Pixel limit must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
    }
    if (!Number.isSafeInteger(width * height) || width * height > this.maxPixels) {
      throw new RangeError(`Image dimensions ${width}\xD7${height} exceed the pixel limit ${this.maxPixels}.`);
    }
    const result = new _RgbaSurface(width, height, void 0, { maxPixels: this.maxPixels });
    const offsets = new Uint32Array(width), inputWords = wordView(this.rgba), outputWords = wordView(result.rgba);
    for (let x = 0; x < width; x++) {
      offsets[x] = Math.min(this.width - 1, Math.floor(scale === void 0 ? x * this.width / width : x / scale));
    }
    for (let y = 0; y < height; y++) {
      const sy = Math.min(this.height - 1, Math.floor(scale === void 0 ? y * this.height / height : y / scale));
      const sourceRow = sy * this.width, destinationRow = y * width;
      if (inputWords && outputWords) {
        for (let x = 0; x < width; x++) {
          outputWords[destinationRow + x] = inputWords[sourceRow + offsets[x]];
        }
      } else {
        for (let x = 0; x < width; x++) {
          const input = (sourceRow + offsets[x]) * 4, output = (destinationRow + x) * 4;
          result.rgba[output] = this.rgba[input];
          result.rgba[output + 1] = this.rgba[input + 1];
          result.rgba[output + 2] = this.rgba[input + 2];
          result.rgba[output + 3] = this.rgba[input + 3];
        }
      }
    }
    return result;
  }
  /** Inclusive 1px Bresenham line. Clip the segment first to bound work by visible dimensions. */
  line(x0, y0, x1, y1, color) {
    if (!Number.isSafeInteger(x0) || x0 < -2147483647 || x0 > 2147483647) {
      throw new RangeError("Line x0 must be an integer in [-2147483647, 2147483647].");
    }
    if (!Number.isSafeInteger(y0) || y0 < -2147483647 || y0 > 2147483647) {
      throw new RangeError("Line y0 must be an integer in [-2147483647, 2147483647].");
    }
    if (!Number.isSafeInteger(x1) || x1 < -2147483647 || x1 > 2147483647) {
      throw new RangeError("Line x1 must be an integer in [-2147483647, 2147483647].");
    }
    if (!Number.isSafeInteger(y1) || y1 < -2147483647 || y1 > 2147483647) {
      throw new RangeError("Line y1 must be an integer in [-2147483647, 2147483647].");
    }
    colorRGBA(color);
    const dx = x1 - x0;
    const dy = y1 - y0;
    let start = 0;
    let end = 1;
    for (const [p, q] of [
      [-dx, x0],
      [dx, this.width - 1 - x0],
      [-dy, y0],
      [dy, this.height - 1 - y0]
    ]) {
      if (p === 0) {
        if (q < 0) {
          return this;
        }
        continue;
      }
      const ratio = q / p;
      if (p < 0) {
        start = Math.max(start, ratio);
      } else {
        end = Math.min(end, ratio);
      }
      if (start > end) {
        return this;
      }
    }
    x1 = Math.round(x0 + end * dx);
    y1 = Math.round(y0 + end * dy);
    x0 = Math.round(x0 + start * dx);
    y0 = Math.round(y0 + start * dy);
    if (x0 === x1) {
      return this.fill(color, {
        x: x0,
        y: Math.min(y0, y1),
        width: 1,
        height: Math.abs(y1 - y0) + 1
      });
    }
    if (y0 === y1) {
      return this.fill(color, {
        x: Math.min(x0, x1),
        y: y0,
        width: Math.abs(x1 - x0) + 1,
        height: 1
      });
    }
    const ax = Math.abs(x1 - x0), ay = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let error = ax + ay;
    while (true) {
      const offset = (y0 * this.width + x0) * 4;
      this.rgba[offset] = color[0];
      this.rgba[offset + 1] = color[1];
      this.rgba[offset + 2] = color[2];
      this.rgba[offset + 3] = color[3];
      if (x0 === x1 && y0 === y1) {
        break;
      }
      const doubled = error * 2;
      if (doubled >= ay) {
        error += ay;
        x0 += sx;
      }
      if (doubled <= ax) {
        error += ax;
        y0 += sy;
      }
    }
    return this;
  }
  measureText(text, options) {
    return BitmapText.measure(text, options);
  }
  drawText(text, x, y, color, options) {
    colorRGBA(color);
    drawBitmapText(this, text, x, y, color, options);
    return this;
  }
};

// node_modules/@uttori/data-tools/dist/image/data-image-png.js
var debug2 = () => {
};
if (typeof process !== "undefined" && false) {
  try {
    const { default: d } = null;
    debug2 = d("Uttori.ImagePNG");
  } catch {
  }
}
function zlibState(inflator) {
  return inflator.strm;
}
var PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
var ADAM7_PASSES = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2]
];
var SINGLE_PASS = [[0, 0, 1, 1]];
var COLOR_DEPTHS = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16]
};
var ANIMATION_CHUNKS = /* @__PURE__ */ new Set(["acTL", "fcTL", "fdAT"]);
var DEFAULT_LIMITS = Object.freeze({
  maxInputBytes: 64 * 1024 * 1024,
  maxPixels: 4 * 1024 * 1024,
  maxInflatedBytes: 64 * 1024 * 1024,
  maxOutputBytes: 64 * 1024 * 1024,
  maxChunks: 16384
});
function resolveLimits(options = {}) {
  const result = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(result)) {
    const value = options[key];
    if (value !== void 0) {
      if (!Number.isSafeInteger(value) || value < 1 || value > Number.MAX_SAFE_INTEGER) {
        throw new RangeError(`${String(key)} must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
      }
      result[key] = value;
    }
  }
  return result;
}
function prepareInput(input, options, maxInputBytes) {
  if (options.copyInput !== void 0 && typeof options.copyInput !== "boolean") {
    throw new TypeError("copyInput must be a boolean.");
  }
  if (options.allow16Bit !== void 0 && typeof options.allow16Bit !== "boolean") {
    throw new TypeError("allow16Bit must be a boolean.");
  }
  if (options.animation !== void 0 && options.animation !== "reject" && options.animation !== "default-image") {
    throw new Error("animation must be reject or default-image.");
  }
  if (input instanceof data_buffer_default) {
    input = input.data;
  }
  if (typeof input === "number") {
    throw new TypeError("ImagePNG requires PNG data, not an allocation length.");
  }
  let bytes;
  if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (ArrayBuffer.isView(input)) {
    bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else if (Array.isArray(input) || typeof input === "string") {
    if (input.length > maxInputBytes) {
      throw new RangeError("PNG exceeds the input byte limit.");
    }
    bytes = new data_buffer_default(input).data;
  } else {
    throw new TypeError("ImagePNG requires PNG bytes or a DataBuffer.");
  }
  if (bytes.length > maxInputBytes) {
    throw new RangeError("PNG exceeds the input byte limit.");
  }
  if (options.copyInput === false) {
    return bytes;
  }
  return Uint8Array.from(bytes);
}
function passLength(size, start, step) {
  if (size <= start) {
    return 0;
  }
  return Math.ceil((size - start) / step);
}
function paethPredictor(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  if (aboveDistance <= upperLeftDistance) {
    return above;
  }
  return upperLeft;
}
function unfilterRow(row, previous, bpp, length, filter) {
  const leading = Math.min(bpp, length);
  switch (filter) {
    case 0:
      break;
    case 1:
      for (let i = bpp; i < length; i++) {
        row[i] += row[i - bpp];
      }
      break;
    case 2:
      for (let i = 0; i < length; i++) {
        row[i] += previous[i];
      }
      break;
    case 3:
      for (let i = 0; i < leading; i++) {
        row[i] += previous[i] >>> 1;
      }
      for (let i = leading; i < length; i++) {
        row[i] += row[i - bpp] + previous[i] >>> 1;
      }
      break;
    case 4:
      for (let i = 0; i < leading; i++) {
        row[i] += previous[i];
      }
      for (let i = leading; i < length; i++) {
        row[i] += paethPredictor(row[i - bpp], previous[i], previous[i - bpp]);
      }
      break;
    default:
      throw new Error(`Invalid PNG scanline filter ${filter}.`);
  }
}
function unfilterScanline(filter, pixels, scanline, bpp, offset, length) {
  if (!Number.isSafeInteger(bpp) || bpp < 1 || bpp > 2147483647) {
    throw new RangeError("Unfilter stride must be an integer in [1, 2147483647].");
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647) {
    throw new RangeError("Unfilter offset must be an integer in [0, 2147483647].");
  }
  if (!Number.isSafeInteger(length) || length < 0 || length > 2147483647) {
    throw new RangeError("Unfilter length must be an integer in [0, 2147483647].");
  }
  if (offset + length > pixels.length || length > scanline.length) {
    throw new RangeError("Unfilter buffer is too small.");
  }
  const row = Uint8Array.from(scanline.slice(0, length));
  const previous = new Uint8Array(length);
  if (offset >= length) {
    for (let i = 0; i < length; i++) {
      previous[i] = pixels[offset - length + i];
    }
  }
  unfilterRow(row, previous, bpp, length, filter);
  if (pixels instanceof Uint8Array) {
    pixels.set(row, offset);
  } else {
    for (let i = 0; i < length; i++) {
      pixels[offset + i] = row[i];
    }
  }
  return pixels;
}
function validateIndexed(image, bitDepth, maxPixels) {
  if (!Number.isSafeInteger(image.width) || image.width < 1 || image.width > 2147483647) {
    throw new RangeError("Width must be an integer in [1, 2147483647].");
  }
  if (!Number.isSafeInteger(image.height) || image.height < 1 || image.height > 2147483647) {
    throw new RangeError("Height must be an integer in [1, 2147483647].");
  }
  if (!Number.isSafeInteger(image.width * image.height) || image.width * image.height > maxPixels) {
    throw new RangeError(`Image dimensions ${image.width}x${image.height} exceed the pixel limit ${maxPixels}.`);
  }
  if (bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4 && bitDepth !== 8) {
    throw new Error("Indexed bit depth must be 1, 2, 4, or 8.");
  }
  if (!Array.isArray(image.palette)) {
    throw new TypeError("Palette must be an array of RGBA8 slots.");
  }
  if (!Number.isSafeInteger(image.palette.length) || image.palette.length < 1 || image.palette.length > 2 ** bitDepth) {
    throw new RangeError(`Palette slots must be an integer in [1, ${2 ** bitDepth}].`);
  }
  for (const color of image.palette) {
    if (!Array.isArray(color) || color.length !== 4) {
      throw new Error("Palette entries require RGBA8.");
    }
    for (const value of color) {
      if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
        throw new RangeError("Palette component must be an integer in [0, 255].");
      }
    }
  }
  if (!(image.indexes instanceof Uint8Array) || image.indexes.length !== image.width * image.height) {
    throw new Error("Indexed buffer length does not match dimensions.");
  }
  for (const index of image.indexes) {
    if (index >= image.palette.length) {
      throw new Error("PNG pixel index exceeds palette slots.");
    }
  }
}
function joinChunks(parts, maxBytes) {
  let length = 0;
  for (const part of parts) {
    length += part.length;
  }
  if (!Number.isSafeInteger(length) || length > maxBytes) {
    throw new RangeError("PNG exceeds the output byte limit.");
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
function makeChunk(type, data) {
  if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) {
    throw new Error(`Invalid PNG chunk type '${type}'.`);
  }
  if (!Number.isSafeInteger(data.length) || data.length < 0 || data.length > 2147483647) {
    throw new RangeError("Chunk length must be an integer in [0, 2147483647].");
  }
  const header = data_buffer_default.allocate(8);
  header.writeUInt32(data.length);
  header.writeString(type);
  header.commit();
  const output = new Uint8Array(data.length + 12);
  output.set(header.data);
  output.set(data, 8);
  const checksum = data_buffer_default.allocate(4);
  checksum.writeUInt32(computeBytes(output.subarray(4, data.length + 8)));
  checksum.commit();
  output.set(checksum.data, data.length + 8);
  return output;
}
function makeHeader(width, height, bitDepth, colorType) {
  const header = data_buffer_default.allocate(13);
  header.writeUInt32(width);
  header.writeUInt32(height);
  header.writeUInt8(bitDepth);
  header.writeUInt8(colorType);
  header.writeUInt8(0);
  header.writeUInt8(0);
  header.writeUInt8(0);
  header.commit();
  return header.data;
}
function makePaletteChunks(palette) {
  const rgb = new Uint8Array(palette.length * 3);
  const alpha = new Uint8Array(palette.length);
  for (let i = 0; i < palette.length; i++) {
    const color = palette[i];
    rgb[i * 3] = color[0];
    rgb[i * 3 + 1] = color[1];
    rgb[i * 3 + 2] = color[2];
    alpha[i] = color[3];
  }
  return [makeChunk("PLTE", rgb), makeChunk("tRNS", alpha)];
}
var ImagePNG = class _ImagePNG extends data_buffer_default {
  /** Pixel Width */
  width;
  /** Pixel Height */
  height;
  /** Image Bit Depth, one of: 1, 2, 4, 8, 16 */
  bitDepth;
  /** Defines pixel structure, one of: 0, 2, 3, 4, 6 */
  colorType;
  /** Type of compression, always 0 */
  compressionMethod;
  /** Type of filtering, always 0 */
  filterMethod;
  /** Type of interlacing, one of: 0, 1 */
  interlaceMethod;
  /** Number of native samples per pixel, not the number of packed bytes. */
  colors;
  /** True when the image has an alpha transparency layer */
  alpha;
  /** Raw Color data */
  palette;
  /** Row-major native samples, with one element per sample or index. */
  pixels;
  /** Raw Transparency data */
  transparency;
  /** Object containing physical dimension information */
  physical;
  /** Image Data pieces */
  dataChunks;
  /** PNG Signature from the data */
  header;
  /** Validated chunks, including views of their original framing and CRC. */
  chunks;
  /** Whether animation chunks were found under the explicit default-image policy. */
  animated;
  /** Decoder policies captured at construction. */
  options;
  /** True when the image has been decoded */
  _decoded;
  /** Validated allocation bounds, reused for parsing and decoding. */
  _limits;
  /** Chunk names used for singleton and ordering checks. */
  _seenChunks;
  /** Whether a non-IDAT chunk has ended the contiguous IDAT sequence. */
  _dataEnded;
  /**
   * Creates a new ImagePNG.
   *
   * The container is validated immediately; native pixels are decoded on demand.
   * @param input The data to process.
   * @param options Ownership, allocation limits, and format policies.
   * @throws {Error} Signature, framing, CRC, ordering, or metadata are invalid.
   */
  constructor(input, options = {}) {
    const limits = resolveLimits(options);
    super(prepareInput(input, options, limits.maxInputBytes));
    this.width = 0;
    this.height = 0;
    this.bitDepth = 0;
    this.colorType = 0;
    this.compressionMethod = 0;
    this.filterMethod = 0;
    this.interlaceMethod = 0;
    this.colors = 0;
    this.alpha = false;
    this.palette = new Uint8Array();
    this.pixels = new Uint8Array();
    this.transparency = new Uint8Array();
    this.physical = { width: 0, height: 0, unit: 0 };
    this.dataChunks = [];
    this.header = new Uint8Array();
    this.chunks = [];
    this.animated = false;
    this.options = Object.freeze({ ...options });
    this._decoded = false;
    this._limits = Object.freeze(limits);
    this._seenChunks = /* @__PURE__ */ new Set();
    this._dataEnded = false;
    this.parse();
  }
  /**
   * Creates a new ImagePNG from file data.
   *
   * The container is validated immediately; native pixels are decoded on demand.
   * @param data The data of the image to process.
   * @param options Ownership, allocation limits, and format policies.
   * @returns {ImagePNG} the new ImagePNG instance for the provided file data
   * @static
   */
  static fromFile(data, options = {}) {
    debug2("fromFile");
    return new _ImagePNG(data, options);
  }
  /**
   * Creates a new ImagePNG from a DataBuffer.
   *
   * The container is validated immediately; native pixels are decoded on demand.
   * @param buffer The DataBuffer of the image to process.
   * @param options Ownership, allocation limits, and format policies.
   * @returns the new ImagePNG instance for the provided DataBuffer
   * @static
   */
  static fromBuffer(buffer, options = {}) {
    debug2("fromBuffer:", buffer.length);
    return new _ImagePNG(buffer, options);
  }
  /**
   * Sets the bitDepth on the ImagePNG instance.
   *
   * Discard samples decoded with the old layout. The complete color/depth
   * combination is checked before decoding.
   * @param bitDepth The bitDepth to set, one of: 1, 2, 4, 8, 16
   * @throws {Error} The depth is invalid or disabled by caller policy.
   */
  setBitDepth(bitDepth) {
    debug2("setBitDepth:", bitDepth);
    if (![1, 2, 4, 8, 16].includes(bitDepth)) {
      throw new Error(`Invalid Bit Depth: ${bitDepth}, can be one of: 1, 2, 4, 8, 16`);
    }
    if (bitDepth === 16 && this.options.allow16Bit === false) {
      throw new Error("16-bit PNG samples are disabled by caller policy.");
    }
    this.bitDepth = bitDepth;
    this.invalidatePixels();
  }
  /**
   * Sets the colorType on the ImagePNG instance.
   * Both color and alpha properties are inferred from the colorType.
   *
   * | Color Type | Allowed Bit Depths | Interpretation |
   * |------------|--------------------|----------------|
   * | 0          | 1, 2, 4, 8, 16     | Each pixel is a grayscale sample.
   * | 2          | 8, 16              | Each pixel is an R, G, B triple.
   * | 3          | 1, 2, 4, 8         | Each pixel is a palette index; a `PLTE` chunk must appear.
   * | 4          | 8, 16              | Each pixel is a grayscale sample, followed by an alpha sample.
   * | 6          | 8, 16              | Each pixel is an R, G, B triple, followed by an alpha sample.
   *
   * Discard samples decoded with the old layout.
   * @param colorType The colorType to set, one of: 0, 2, 3, 4, 6
   * @throws {Error} Invalid Color Type, anything other than 0, 2, 3, 4, 6
   */
  setColorType(colorType) {
    debug2("setColorType:", colorType);
    let colors = 0;
    let alpha = false;
    switch (colorType) {
      case 0:
      case 3:
        colors = 1;
        break;
      case 2:
        colors = 3;
        break;
      case 4:
        colors = 2;
        alpha = true;
        break;
      case 6:
        colors = 4;
        alpha = true;
        break;
      default:
        throw new Error(`Invalid Color Type: ${colorType}, can be one of: 0, 2, 3, 4, 6`);
    }
    this.colors = colors;
    this.alpha = alpha;
    this.colorType = colorType;
    this.invalidatePixels();
  }
  /**
   * Sets the compressionMethod on the ImagePNG instance.
   * The compressionMethod should always be 0.
   * @param compressionMethod The compressionMethod to set, always 0
   * @throws {Error} Unsupported Compression Method, anything other than 0
   */
  setCompressionMethod(compressionMethod) {
    if (compressionMethod !== 0) {
      throw new Error(`Unsupported Compression Method: ${compressionMethod}, should be 0`);
    }
    this.compressionMethod = compressionMethod;
  }
  /**
   * Sets the filterMethod on the ImagePNG instance.
   * The filterMethod should always be 0.
   * @param filterMethod The filterMethod to set, always 0
   * @throws {Error} Unsupported Filter Method, anything other than 0
   */
  setFilterMethod(filterMethod) {
    if (filterMethod !== 0) {
      throw new Error(`Unsupported Filter Method: ${filterMethod}, should be 0`);
    }
    this.filterMethod = filterMethod;
  }
  /**
   * Sets the interlaceMethod on the ImagePNG instance.
   * The interlaceMethod should always be 0 or 1.
   *
   * Discard samples decoded with the old layout.
   * @param interlaceMethod The interlaceMethod to set, always 0 or 1
   * @throws {Error} Unsupported Interlace Method, anything other than 0 or 1
   */
  setInterlaceMethod(interlaceMethod) {
    if (interlaceMethod !== 0 && interlaceMethod !== 1) {
      throw new Error(`Unsupported Interlace Method: ${interlaceMethod}`);
    }
    this.interlaceMethod = interlaceMethod;
    this.invalidatePixels();
  }
  /**
   * Sets the palette on the ImagePNG instance.
   *
   * Palette slots retain their identity; duplicate RGB triples are not deduplicated.
   * @param palette The palette to set
   * @throws {Error} No colors in the palette
   * @throws {Error} Too many colors for the current bit depth
   * @throws {Error} Components, transparency length, or referenced slots are invalid.
   */
  setPalette(palette) {
    if (!Array.isArray(palette) && !(palette instanceof Uint8Array) || palette.length === 0 || palette.length % 3 !== 0 || palette.length > 768) {
      throw new Error("Invalid PNG palette; expected 1 to 256 RGB triples.");
    }
    const count = palette.length / 3;
    if (this.colorType === 3 && count > 2 ** this.bitDepth) {
      throw new Error(`Palette contains more than ${2 ** this.bitDepth} colors.`);
    }
    for (const value of palette) {
      if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
        throw new RangeError("Palette byte must be an integer in [0, 255].");
      }
    }
    if (this.colorType === 3) {
      if (this.transparency.length > count) {
        throw new Error("Transparency exceeds the new palette.");
      }
      if (this._decoded) {
        for (const index of this.pixels) {
          if (index >= count) {
            throw new Error("Decoded index exceeds the new palette.");
          }
        }
      }
    }
    this.palette = Uint8Array.from(palette);
  }
  /** Discard decoded native samples without changing the original compressed IDAT data. */
  invalidatePixels() {
    this._decoded = false;
    if (this.pixels.length !== 0) {
      this.pixels = new Uint8Array();
    }
  }
  /**
   * Parse the PNG file, decoding the supported chunks.
   *
   * Start from the beginning and reset metadata and cached samples.
   * @returns This image.
   * @throws {Error} Required chunks are missing or any chunk fails validation.
   */
  parse() {
    debug2("parse");
    if (this.data.length > this._limits.maxInputBytes) {
      throw new RangeError("PNG exceeds the input byte limit.");
    }
    this.reset();
    this.palette = new Uint8Array();
    this.transparency = new Uint8Array();
    this.physical = { width: 0, height: 0, unit: 0 };
    this.dataChunks = [];
    this.chunks = [];
    this.animated = false;
    this._seenChunks.clear();
    this._dataEnded = false;
    this.invalidatePixels();
    this.decodeHeader();
    while (this.remainingBytes() > 0) {
      if (this.decodeChunk() === "IEND") {
        break;
      }
    }
    if (!this._seenChunks.has("IHDR") || !this._seenChunks.has("IEND")) {
      throw new Error("PNG is missing IHDR or IEND.");
    }
    this._expectedInflatedBytes();
    return this;
  }
  /**
   * Decodes and validates PNG Header.
   * Signature (Decimal): [137, 80, 78, 71, 13, 10, 26, 10]
   * Signature (Hexadecimal): [89, 50, 4E, 47, 0D, 0A, 1A, 0A]
   * Signature (ASCII): [\211, P, N, G, \r, \n, \032, \n]
   * @throws {Error} Missing or invalid PNG header
   * @throws {Error} The header is not being read from offset zero.
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#5PNG-file-signature|PNG Signature}
   */
  decodeHeader() {
    if (this.offset !== 0) {
      throw new Error("PNG header must be read at offset zero.");
    }
    if (!this.isNextBytes(PNG_SIGNATURE)) {
      throw new Error("Missing or invalid PNG header.");
    }
    this.header = this.read(PNG_SIGNATURE.length);
  }
  /**
   * Decodes the chunk type, and attempts to parse that chunk if supported.
   * Supported Chunk Types: IHDR, PLTE, IDAT, IEND, tRNS, pHYs
   *
   * Chunk Structure:
   * Length: 4 bytes
   * Type:   4 bytes (IHDR, PLTE, IDAT, IEND, etc.)
   * Chunk:  {length} bytes
   * CRC:    4 bytes
   *
   * Validate CRCs, chunk ordering, and bounds before dispatching.
   * Ancillary records retain their original framing for indexed rewriting.
   * @returns {string} Chunk Type
   * @throws {Error} Invalid chunk length, CRC, ordering, or critical chunk type.
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#5Chunk-layout|Chunk Layout}
   */
  decodeChunk() {
    const offset = this.offset;
    if (!Number.isSafeInteger(offset) || offset < 8 || offset > this.data.length) {
      throw new RangeError(`Chunk offset must be an integer in [8, ${this.data.length}].`);
    }
    if (this.chunks.length >= this._limits.maxChunks) {
      throw new RangeError("PNG exceeds the chunk count limit.");
    }
    if (this._seenChunks.has("IEND")) {
      throw new Error("PNG contains data after IEND.");
    }
    if (!this.available(12)) {
      throw new Error("Truncated PNG chunk header.");
    }
    const length = this.peekUInt32(offset);
    if (length > 2147483647 || length > this.data.length - offset - 12) {
      throw new Error("Invalid PNG chunk length.");
    }
    const end = offset + length + 12;
    const type = this.peekString(offset + 4, 4);
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) {
      throw new Error(`Invalid PNG chunk type '${type}'.`);
    }
    const expectedCrc = this.peekUInt32(end - 4);
    const actualCrc = computeBytes(this.data.subarray(offset + 4, end - 4));
    if (expectedCrc !== actualCrc) {
      throw new Error(`PNG ${type} CRC mismatch.`);
    }
    if (!this._seenChunks.has("IHDR") && type !== "IHDR") {
      throw new Error("PNG IHDR must be first.");
    }
    const chunk = this.data.subarray(offset + 8, end - 4);
    const critical = (this.peekUInt8(offset + 4) & 32) === 0;
    const dataSeen = this.dataChunks.length !== 0;
    debug2("decodeChunk:", type, "length:", length);
    switch (type) {
      case "IHDR":
        if (this._seenChunks.has(type)) {
          throw new Error("PNG requires exactly one IHDR.");
        }
        this.decodeIHDR(chunk);
        break;
      case "PLTE":
        if (this._seenChunks.has(type) || dataSeen || this._seenChunks.has("tRNS") || this.colorType === 0 || this.colorType === 4) {
          throw new Error("Invalid PNG PLTE placement.");
        }
        this.decodePLTE(chunk);
        break;
      case "tRNS":
        if (this._seenChunks.has(type) || dataSeen) {
          throw new Error("Invalid PNG tRNS placement.");
        }
        this.decodeTRNS(chunk);
        break;
      case "pHYs":
        if (this._seenChunks.has(type) || dataSeen) {
          throw new Error("Invalid PNG pHYs placement.");
        }
        this.decodePHYS(chunk);
        break;
      case "IDAT":
        if (this._dataEnded || this.colorType === 3 && !this._seenChunks.has("PLTE")) {
          throw new Error("PNG IDAT chunks must be contiguous and follow PLTE.");
        }
        this.decodeIDAT(chunk);
        break;
      case "IEND":
        if (!dataSeen || end !== this.data.length) {
          throw new Error("Invalid PNG IEND chunk or trailing file bytes.");
        }
        this.decodeIEND(chunk);
        break;
      // case 'cHRM': decodeCHRM(chunk); break;
      // case 'gAMA': decodeGAMA(chunk); break;
      // case 'bKGD': decodeBKGD(chunk); break;
      // case 'tIME': decodeTIME(chunk); break;
      // case 'tEXt': decodeTEXT(chunk); break;
      // case 'iTXt': decodeITXT(chunk); break;
      // case 'sRGB': decodeSRGB(chunk); break;
      // case 'sBIT': decodeSBIT(chunk); break;
      default:
        if (critical) {
          throw new Error(`Unsupported critical PNG chunk '${type}'.`);
        }
        if (ANIMATION_CHUNKS.has(type)) {
          if (this.options.animation !== "default-image") {
            throw new Error("Animated PNG is not supported; request animation: default-image explicitly.");
          }
          this.animated = true;
        }
        break;
    }
    this.chunks.push({
      type,
      offset,
      end,
      length,
      data: chunk,
      raw: this.data.subarray(offset, end),
      critical,
      safeToCopy: (this.peekUInt8(offset + 7) & 32) !== 0
    });
    this._seenChunks.add(type);
    if (dataSeen && type !== "IDAT") {
      this._dataEnded = true;
    }
    this.seek(end);
    return type;
  }
  /**
   * Decode the IHDR (Image header) chunk.
   * Should be the first chunk in the data stream.
   *
   * Width:              4 bytes
   * Height:             4 bytes
   * Bit Depth:          1 byte
   * Colour Type:        1 byte
   * Compression Method: 1 byte
   * Filter Method:      1 byte
   * Interlace Method:   1 byte
   * @param chunk Data Blob
   * @throws {Error} Dimensions, sample layout, or PNG methods are invalid.
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#11IHDR|Image Header}
   * @see {@link http://www.libpng.org/pub/png/spec/1.2/png-1.2-pdg.html#C.IHDR|Image Header}
   */
  decodeIHDR(chunk) {
    if (chunk.length !== 13) {
      throw new Error("PNG requires a 13-byte IHDR.");
    }
    const header = new data_buffer_default(chunk);
    const width = header.readUInt32();
    const height = header.readUInt32();
    const bitDepth = header.readUInt8();
    const colorType = header.readUInt8();
    const compressionMethod = header.readUInt8();
    const filterMethod = header.readUInt8();
    const interlaceMethod = header.readUInt8();
    if (!Number.isSafeInteger(width) || width < 1 || width > 2147483647) {
      throw new RangeError("Width must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(height) || height < 1 || height > 2147483647) {
      throw new RangeError("Height must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(width * height) || width * height > this._limits.maxPixels) {
      throw new RangeError(`Image dimensions ${width}x${height} exceed the pixel limit ${this._limits.maxPixels}.`);
    }
    if (!COLOR_DEPTHS[colorType]?.includes(bitDepth)) {
      throw new Error(`Invalid PNG color type ${colorType} at ${bitDepth} bits.`);
    }
    this.width = width;
    this.height = height;
    this.setBitDepth(bitDepth);
    this.setColorType(colorType);
    this.setCompressionMethod(compressionMethod);
    this.setFilterMethod(filterMethod);
    this.setInterlaceMethod(interlaceMethod);
  }
  /**
   * Decode the PLTE (Palette) chunk.
   * The PLTE chunk contains from 1 to 256 palette entries, each a three-byte series of the form.
   * The number of entries is determined from the chunk length. A chunk length not divisible by 3 is an error.
   *
   * Preserve the original palette slot order, including duplicate colors.
   * @param chunk Data Blob
   * @see {@link http://www.w3.org/TR/PNG/#11PLTE|Palette}
   */
  decodePLTE(chunk) {
    this.setPalette(chunk);
  }
  /**
   * Decode the IDAT (Image Data) chunk.
   * The IDAT chunk contains the actual image data which is the output stream of the compression algorithm.
   *
   * Retain a payload view for bounded inflation on demand and invalidate cached
   * samples. Empty IDAT chunks are legal.
   * @param chunk Data Blob
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#11IDAT|Image Data}
   */
  decodeIDAT(chunk) {
    this.dataChunks.push(chunk);
    this.invalidatePixels();
  }
  /**
   * Decode the tRNS (Transparency) chunk.
   * The tRNS chunk specifies that the image uses simple transparency: either alpha values associated with palette entries (for indexed-color images) or a single transparent color (for grayscale and truecolor images). Although simple transparency is not as elegant as the full alpha channel, it requires less storage space and is sufficient for many common cases.
   * @param chunk Data Blob
   * @throws {Error} Transparency is incompatible with the color type or sample depth.
   * @see {@link https://www.w3.org/TR/PNG/#11tRNS|Transparency}
   */
  decodeTRNS(chunk) {
    switch (this.colorType) {
      case 3:
        if (this.palette.length === 0 || chunk.length === 0 || chunk.length > this.palette.length / 3) {
          throw new Error("Invalid indexed PNG tRNS chunk.");
        }
        break;
      case 0:
        if (chunk.length !== 2) {
          throw new Error("Grayscale PNG tRNS requires two bytes.");
        }
        break;
      case 2:
        if (chunk.length !== 6) {
          throw new Error("RGB PNG tRNS requires six bytes.");
        }
        break;
      default:
        throw new Error("PNG color types with alpha cannot contain tRNS.");
    }
    if (this.colorType !== 3) {
      const maximum = 2 ** this.bitDepth - 1;
      const buffer = new data_buffer_default(chunk);
      while (buffer.remainingBytes() > 0) {
        if (buffer.readUInt16() > maximum) {
          throw new Error("PNG tRNS sample exceeds bit depth.");
        }
      }
    }
    this.transparency = Uint8Array.from(chunk);
  }
  /**
   * Decode the pHYs (Pixel Dimensions) chunk.
   * The pHYs chunk specifies the intended pixel size or aspect ratio for display of the image.
   * When the unit specifier is 0, the pHYs chunk defines pixel aspect ratio only; the actual size of the pixels remains unspecified.
   * If the pHYs chunk is not present, pixels are assumed to be square, and the physical size of each pixel is unspecified.
   *
   * Structure:
   * Pixels per unit, X axis: 4 bytes (unsigned integer)
   * Pixels per unit, Y axis: 4 bytes (unsigned integer)
   * Unit specifier:          1 byte
   * 0: unit is unknown
   * 1: unit is the meter
   *
   * Keep the raw pixels-per-unit values. When unit is 1, multiplying by 0.0254
   * converts pixels per meter to pixels per inch without changing stored metadata.
   * @param chunk Data Blob
   * @throws {Error} The length or unit specifier is invalid.
   * @see {@link https://www.w3.org/TR/PNG/#11pHYs|Pixel Dimensions}
   */
  decodePHYS(chunk) {
    if (chunk.length !== 9) {
      throw new Error("Invalid PNG pHYs chunk.");
    }
    const buffer = new data_buffer_default(chunk);
    const width = buffer.readUInt32();
    const height = buffer.readUInt32();
    const unit = buffer.readUInt8();
    if (unit > 1) {
      throw new Error("Invalid PNG pHYs chunk.");
    }
    this.physical = { width, height, unit };
  }
  /**
   * Decode the IEND (Image trailer) chunk.
   * The IEND chunk marks the end of the PNG DataBuffer. The chunk's data field is empty.
   * @param chunk The IEND payload, which must have no bytes.
   * @throws {Error} IEND contains data.
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#11IEND|Image Trailer}
   */
  decodeIEND(chunk) {
    if (chunk.length !== 0) {
      throw new Error("IEND must be empty.");
    }
  }
  /**
   * Measure the exact decompressed layout, including filter bytes for each pass.
   * @param interlaceMethod The layout to measure; defaults to the current IHDR value.
   * @returns Expected filtered scanline byte count.
   * @throws {Error} The layout is invalid or exceeds the inflation limit.
   */
  _expectedInflatedBytes(interlaceMethod = this.interlaceMethod) {
    if (!Number.isSafeInteger(this.width) || this.width < 1 || this.width > 2147483647) {
      throw new RangeError("Width must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(this.height) || this.height < 1 || this.height > 2147483647) {
      throw new RangeError("Height must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(this.width * this.height) || this.width * this.height > this._limits.maxPixels) {
      throw new RangeError(`Image dimensions ${this.width}x${this.height} exceed the pixel limit ${this._limits.maxPixels}.`);
    }
    if (!COLOR_DEPTHS[this.colorType]?.includes(this.bitDepth)) {
      throw new Error(`Invalid PNG color type ${this.colorType} at ${this.bitDepth} bits.`);
    }
    if (interlaceMethod !== 0 && interlaceMethod !== 1) {
      throw new Error(`Unsupported Interlace Method: ${interlaceMethod}`);
    }
    let passes = SINGLE_PASS;
    if (interlaceMethod === 1) {
      passes = ADAM7_PASSES;
    }
    let expected = 0;
    for (const [startX, startY, stepX, stepY] of passes) {
      const width = passLength(this.width, startX, stepX);
      const height = passLength(this.height, startY, stepY);
      if (width !== 0 && height !== 0) {
        const rowBytes = Math.ceil(width * this.colors * this.bitDepth / 8);
        expected += height * (rowBytes + 1);
      }
    }
    if (!Number.isSafeInteger(expected) || expected > this._limits.maxInflatedBytes) {
      throw new RangeError("PNG exceeds the inflated byte limit.");
    }
    return expected;
  }
  /**
   * Uncompress IDAT chunks.
   *
   * Reverse scanline filters and unpack native samples after bounded inflation.
   * Successful decodes are cached. Forcing a decode discards in-memory pixel edits
   * and reconstructs the source IDAT; failures never expose partial pixel buffers.
   * @param options Cache control for this decode.
   * @param options.force Discard cached samples and decode the source again.
   * @returns Row-major native samples, retaining original palette indexes.
   * @throws {Error} No IDAT chunks to decode
   * @throws {Error} Deinterlacing Error
   * @throws {Error} Inflating Error
   * @throws {Error} Compressed data, scanline lengths, filters, or indexes are invalid.
   */
  decodePixels({ force = false } = {}) {
    if (typeof force !== "boolean") {
      throw new TypeError("force must be a boolean.");
    }
    if (this._decoded && !force) {
      return this.pixels;
    }
    this.invalidatePixels();
    if (this.dataChunks.length === 0) {
      throw new Error("No IDAT chunks to decode.");
    }
    const expected = this._expectedInflatedBytes();
    const output = new Uint8Array(expected);
    const inflator = new Inflate({
      windowBits: 15,
      chunkSize: 16 * 1024
    });
    const zlib = zlibState(inflator);
    let written = 0;
    let compressedLength = 0;
    let ended = false;
    let errorCode = 0;
    inflator.onData = (chunk) => {
      if (written + chunk.length > expected) {
        throw new Error("PNG inflated data exceeds declared dimensions.");
      }
      output.set(chunk, written);
      written += chunk.length;
    };
    inflator.onEnd = (status) => {
      ended = true;
      errorCode = status;
    };
    for (const chunk of this.dataChunks) {
      if (chunk.length === 0) {
        continue;
      }
      if (ended) {
        throw new Error("PNG has compressed data after the zlib stream.");
      }
      compressedLength += chunk.length;
      if (compressedLength > this._limits.maxInputBytes) {
        throw new RangeError("PNG exceeds the input byte limit.");
      }
      if (!inflator.push(chunk, false) || errorCode !== 0) {
        throw new Error(`Invalid PNG image data: ${zlib.msg || "inflate failure"}.`);
      }
      if (zlib.avail_in !== 0) {
        throw new Error("PNG has trailing bytes after the zlib stream.");
      }
    }
    if (!ended || errorCode !== 0 || written !== expected) {
      throw new Error("Invalid PNG image data: incomplete zlib stream or scanline length mismatch.");
    }
    if (zlib.total_in !== compressedLength) {
      throw new Error("PNG IDAT must contain exactly one zlib stream.");
    }
    if (this.interlaceMethod === 0) {
      return this.interlaceNone(output);
    }
    return this.interlaceAdam7(output);
  }
  /**
   * Deinterlace with no interlacing.
   * @param data Data to deinterlace.
   * @returns Native samples, also stored in pixels on success.
   * @see {@link https://www.w3.org/TR/PNG-Filters.html|PNG Filters}
   */
  interlaceNone(data) {
    return this._decodeScanlines(data, 0);
  }
  /**
   * Deinterlace with Adam7 interlacing.
   * Adam7 divides the image into 7 passes with different starting positions and step sizes.
   *
   * Empty passes consume neither filter bytes nor row bytes. Scatter decoded
   * samples into row-major image order without converting palette indexes.
   * @param data Data to deinterlace.
   * @returns Native samples, also stored in pixels on success.
   * @see {@link https://www.w3.org/TR/PNG/#8Interlace|PNG Adam7 Interlacing}
   * @see {@link https://github.com/em2046/lens/blob/master/assets/js/interlace.js}
   * @see {@link https://github.com/em2046/aperture/tree/master/lib/png/chunks}
   * @see {@link https://github.com/beejjorgensen/jsmandel/blob/master/src/js/adam7.js}
   * @see {@link http://diyhpl.us/~yenatch/pokecrystal/src/pypng/code/png.py}
   * @see {@link https://github.com/SixLabors/ImageSharp/blob/master/src/ImageSharp/Formats/Png/Adam7.cs}
   */
  interlaceAdam7(data) {
    return this._decodeScanlines(data, 1);
  }
  /**
   * Share row reconstruction and native sample unpacking across interlace modes.
   * @param data Exact filtered scanline bytes.
   * @param interlaceMethod Zero for the full image, or one for Adam7 passes.
   * @returns The fully reconstructed native sample buffer.
   */
  _decodeScanlines(data, interlaceMethod) {
    this.invalidatePixels();
    if (data.length !== this._expectedInflatedBytes(interlaceMethod)) {
      throw new Error("PNG scanline length mismatch.");
    }
    const { width, height, colors, bitDepth } = this;
    const sampleCount = width * height * colors;
    let samples;
    if (bitDepth === 16) {
      samples = new Uint16Array(sampleCount);
    } else {
      samples = new Uint8Array(sampleCount);
    }
    let passes = SINGLE_PASS;
    if (interlaceMethod === 1) {
      passes = ADAM7_PASSES;
    }
    const bytesPerPixel = Math.max(1, Math.ceil(colors * bitDepth / 8));
    const maxRowBytes = Math.ceil(width * colors * bitDepth / 8);
    let current = new data_buffer_default(maxRowBytes);
    let previous = new data_buffer_default(maxRowBytes);
    const scanlines = new data_buffer_default(data);
    for (const [startX, startY, stepX, stepY] of passes) {
      const passWidth = passLength(width, startX, stepX);
      const passHeight = passLength(height, startY, stepY);
      if (passWidth === 0 || passHeight === 0) {
        continue;
      }
      const rowBytes = Math.ceil(passWidth * colors * bitDepth / 8);
      previous.data.fill(0, 0, rowBytes);
      for (let y = 0; y < passHeight; y++) {
        const filter = scanlines.readUInt8();
        current.data.set(data.subarray(scanlines.offset, scanlines.offset + rowBytes));
        scanlines.advance(rowBytes);
        current.reset();
        unfilterRow(current.data, previous.data, bytesPerPixel, rowBytes, filter);
        let destination = ((startY + y * stepY) * width + startX) * colors;
        if (bitDepth === 8 && stepX === 1) {
          samples.set(current.data.subarray(0, rowBytes), destination);
        } else if (bitDepth < 8) {
          const mask = (1 << bitDepth) - 1;
          for (let x = 0, bit = 0; x < passWidth; x++, bit += bitDepth, destination += stepX) {
            samples[destination] = current.data[bit >>> 3] >>> 8 - bitDepth - (bit & 7) & mask;
          }
        } else {
          for (let x = 0; x < passWidth; x++, destination += stepX * colors) {
            for (let channel = 0; channel < colors; channel++) {
              if (bitDepth === 16) {
                samples[destination + channel] = current.readUInt16();
              } else {
                samples[destination + channel] = current.readUInt8();
              }
            }
          }
        }
        const temporary = previous;
        previous = current;
        current = temporary;
      }
    }
    if (this.colorType === 3) {
      const paletteSize = this.palette.length / 3;
      for (const index of samples) {
        if (index >= paletteSize) {
          throw new Error(`PNG palette index ${index} is out of range.`);
        }
      }
    }
    this.pixels = samples;
    this._decoded = true;
    return samples;
  }
  /**
   * Get indexed pixels without flattening duplicate palette colors.
   * @param options Index-buffer ownership.
   * @param options.copy False to borrow decoded indexes; defaults to true.
   * @returns Native indexes, newly expanded RGBA slots, and original index depth.
   * @throws {Error} The source is not indexed.
   */
  toIndexed({ copy = true } = {}) {
    if (typeof copy !== "boolean") {
      throw new TypeError("copy must be a boolean.");
    }
    if (this.colorType !== 3) {
      throw new Error("PNG does not contain indexed pixels.");
    }
    const pixels = this.decodePixels();
    if (!(pixels instanceof Uint8Array)) {
      throw new Error("Indexed PNG pixels must be byte-sized samples.");
    }
    let indexes = pixels;
    if (copy) {
      indexes = Uint8Array.from(pixels);
    }
    return {
      kind: "indexed-image",
      width: this.width,
      height: this.height,
      indexes,
      palette: this._paletteRGBA(),
      sourceBitDepth: this.bitDepth
    };
  }
  /**
   * Convert native samples to straight-alpha RGBA8 for rendering.
   * Sixteen-bit values are rounded to the nearest eight-bit value after testing
   * native transparency keys. Native samples and indexes remain unchanged.
   * @param options Output-buffer ownership for an RGBA8 source.
   * @param options.copy False to share existing RGBA8 samples; defaults to true.
   * @returns The RGBA surface; other source formats always require a new buffer.
   */
  toRGBA({ copy = true } = {}) {
    if (typeof copy !== "boolean") {
      throw new TypeError("copy must be a boolean.");
    }
    const pixels = this.decodePixels();
    if (this.colorType === 6 && this.bitDepth === 8 && pixels instanceof Uint8Array) {
      return new RgbaSurface(this.width, this.height, pixels, {
        copy,
        maxPixels: this._limits.maxPixels
      });
    }
    const rgba = new Uint8Array(this.width * this.height * 4);
    const key = this._transparencyKey();
    for (let pixel = 0, offset = 0; pixel < this.width * this.height; pixel++, offset += 4) {
      this._writePixel(pixel, rgba, offset, key);
    }
    return new RgbaSurface(this.width, this.height, rgba, {
      copy: false,
      maxPixels: this._limits.maxPixels
    });
  }
  /**
   * Get the pixel color at a specified x, y location.
   *
   * Decode native samples on demand, then convert the selected pixel to RGBA8.
   * Sixteen-bit samples are rounded after testing native transparency keys.
   * Prefer toRGBA() for bulk conversion or getPixelInto() for reusable output.
   * @param x The hoizontal offset to read.
   * @param y The vertical offset to read.
   * @returns the color as [red, green, blue, alpha]
   * @throws {Error} x is out of bound for the image
   * @throws {Error} y is out of bound for the image
   * @throws {Error} Unknown color types
   */
  getPixel(x, y) {
    if (!Number.isSafeInteger(x) || x < 0 || x > this.width - 1) {
      throw new RangeError(`x position must be an integer in [0, ${this.width - 1}].`);
    }
    if (!Number.isSafeInteger(y) || y < 0 || y > this.height - 1) {
      throw new RangeError(`y position must be an integer in [0, ${this.height - 1}].`);
    }
    this.decodePixels();
    const output = [0, 0, 0, 0];
    this._writePixel(y * this.width + x, output, 0, this._transparencyKey());
    return output;
  }
  /**
   * Write an RGBA8 pixel into a caller-owned buffer without allocating an output tuple.
   * @param x Horizontal pixel coordinate.
   * @param y Vertical pixel coordinate.
   * @param output Destination bytes.
   * @param offset First of four writable destination bytes.
   * @returns The same output buffer.
   */
  getPixelInto(x, y, output, offset = 0) {
    if (!Number.isSafeInteger(x) || x < 0 || x > this.width - 1) {
      throw new RangeError(`x position must be an integer in [0, ${this.width - 1}].`);
    }
    if (!Number.isSafeInteger(y) || y < 0 || y > this.height - 1) {
      throw new RangeError(`y position must be an integer in [0, ${this.height - 1}].`);
    }
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647) {
      throw new RangeError("Output offset must be an integer in [0, 2147483647].");
    }
    if (!(output instanceof Uint8Array) || offset + 4 > output.length) {
      throw new RangeError("Output needs four writable bytes.");
    }
    this.decodePixels();
    this._writePixel(y * this.width + x, output, offset, this._transparencyKey());
    return output;
  }
  /**
   * Expand RGB palette metadata into newly owned RGBA tuples without remapping slots.
   * @returns Palette slots, with full opacity for entries omitted from tRNS.
   */
  _paletteRGBA() {
    const palette = [];
    for (let index = 0; index < this.palette.length / 3; index++) {
      const offset = index * 3;
      palette.push([
        this.palette[offset],
        this.palette[offset + 1],
        this.palette[offset + 2],
        this.transparency[index] ?? 255
      ]);
    }
    return palette;
  }
  /**
   * Read a grayscale/RGB transparency key in native sample precision.
   * @returns Key components, or an empty array when there is no color key.
   */
  _transparencyKey() {
    const key = [];
    if (this.colorType !== 0 && this.colorType !== 2) {
      return key;
    }
    if (this.transparency.length !== 0) {
      const buffer = new data_buffer_default(this.transparency);
      while (buffer.remainingBytes() > 0) {
        key.push(buffer.readUInt16());
      }
    }
    return key;
  }
  /**
   * Write one native pixel as RGBA8, retaining RGB beneath transparent alpha.
   * @param pixel Row-major pixel index, not a byte offset.
   * @param output Destination array or byte buffer.
   * @param offset Destination byte offset.
   * @param key Native transparency components, resolved once per bulk conversion.
   */
  _writePixel(pixel, output, offset, key) {
    const source = pixel * this.colors;
    let scale = 1;
    if (this.bitDepth !== 8) {
      scale = 255 / (2 ** this.bitDepth - 1);
    }
    switch (this.colorType) {
      case 3: {
        const index = this.pixels[source];
        const paletteOffset = index * 3;
        output[offset] = this.palette[paletteOffset];
        output[offset + 1] = this.palette[paletteOffset + 1];
        output[offset + 2] = this.palette[paletteOffset + 2];
        output[offset + 3] = this.transparency[index] ?? 255;
        break;
      }
      case 0:
      case 4: {
        const gray = Math.round(this.pixels[source] * scale);
        let alpha = 255;
        if (this.colorType === 4) {
          alpha = Math.round(this.pixels[source + 1] * scale);
        } else if (this.pixels[source] === key[0]) {
          alpha = 0;
        }
        output[offset] = gray;
        output[offset + 1] = gray;
        output[offset + 2] = gray;
        output[offset + 3] = alpha;
        break;
      }
      case 2:
      case 6: {
        let alpha = 255;
        if (this.colorType === 6) {
          alpha = Math.round(this.pixels[source + 3] * scale);
        } else if (this.pixels[source] === key[0] && this.pixels[source + 1] === key[1] && this.pixels[source + 2] === key[2]) {
          alpha = 0;
        }
        output[offset] = Math.round(this.pixels[source] * scale);
        output[offset + 1] = Math.round(this.pixels[source + 1] * scale);
        output[offset + 2] = Math.round(this.pixels[source + 2] * scale);
        output[offset + 3] = alpha;
        break;
      }
      default:
        throw new Error(`Unknown Color Type: ${this.colorType}`);
    }
  }
  /**
   * Encode indexed pixels without quantization, palette reordering, or deduplication.
   * @param image Native indexes and RGBA palette slots.
   * @param options Bit depth, filters, compression level, and allocation limits.
   * @returns Owned non-interlaced PNG bytes; the default index depth is eight bits.
   * @static
   */
  static encodeIndexed(image, options = {}) {
    const limits = resolveLimits(options);
    const bitDepth = options.bitDepth ?? 8;
    validateIndexed(image, bitDepth, limits.maxPixels);
    const compressed = _ImagePNG._encodeIndexedData(image, bitDepth, options, limits);
    return joinChunks([
      PNG_SIGNATURE,
      makeChunk("IHDR", makeHeader(image.width, image.height, bitDepth, 3)),
      ...makePaletteChunks(image.palette),
      makeChunk("IDAT", compressed),
      makeChunk("IEND", new Uint8Array())
    ], limits.maxOutputBytes);
  }
  /**
   * Create an indexed PNG using the encodeIndexed() implementation.
   * @param image Native indexes and RGBA palette slots.
   * @param options Bit depth, filters, compression level, and allocation limits.
   * @returns Owned PNG bytes retaining each supplied palette slot.
   * @static
   */
  static createIndexedPng(image, options = {}) {
    return _ImagePNG.encodeIndexed(image, options);
  }
  /**
   * Encode straight-alpha RGBA8 without changing hidden RGB components.
   * @param image Dimensions and an exact row-major RGBA8 buffer.
   * @param options Filters, compression level, and allocation limits.
   * @returns Owned non-interlaced RGBA8 PNG bytes.
   * @static
   */
  static encodeRGBA(image, options = {}) {
    const limits = resolveLimits(options);
    if (!Number.isSafeInteger(image.width) || image.width < 1 || image.width > 2147483647) {
      throw new RangeError("Width must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(image.height) || image.height < 1 || image.height > 2147483647) {
      throw new RangeError("Height must be an integer in [1, 2147483647].");
    }
    if (!Number.isSafeInteger(image.width * image.height) || image.width * image.height > limits.maxPixels) {
      throw new RangeError(`Image dimensions ${image.width}x${image.height} exceed the pixel limit ${limits.maxPixels}.`);
    }
    if (!(image.rgba instanceof Uint8Array) || image.rgba.length !== image.width * image.height * 4) {
      throw new Error("RGBA buffer length does not match dimensions.");
    }
    const rowBytes = image.width * 4;
    const compressed = _ImagePNG._encodeRows(image.height, rowBytes, 4, (row, y) => {
      row.set(image.rgba.subarray(y * rowBytes, (y + 1) * rowBytes));
    }, options, limits);
    return joinChunks([
      PNG_SIGNATURE,
      makeChunk("IHDR", makeHeader(image.width, image.height, 8, 6)),
      makeChunk("IDAT", compressed),
      makeChunk("IEND", new Uint8Array())
    ], limits.maxOutputBytes);
  }
  /**
   * Rewrite indexed pixels, dimensions, or same-slot palette entries without an RGBA round trip.
   * No-op edits return an exact owned copy. Palette-only changes keep the original
   * IDAT bytes, including Adam7. Pixel edits use new non-interlaced packed rows.
   * Safe-to-copy ancillary chunks survive edits. Unsafe chunks require explicit
   * retention after caller-supplied, format-specific validation.
   * @param source Original PNG file bytes, rather than a mutable decoded model.
   * @param edit Palette edits and optional complete pixel/canvas replacements.
   * @param options Decoder/encoder limits and optional application validation.
   * @returns Owned PNG bytes preserving palette slot identities.
   * @throws {Error} Palette slot count changes or resizing omits replacement pixels.
   * @static
   */
  static rewriteIndexed(source, edit = {}, options = {}) {
    const image = new _ImagePNG(source, options);
    if (image.colorType !== 3) {
      throw new Error("PNG editing requires indexed pixels.");
    }
    const original = image.toIndexed({ copy: false });
    const palette = edit.palette ?? original.palette;
    const width = edit.dimensions?.width ?? original.width;
    const height = edit.dimensions?.height ?? original.height;
    const resized = width !== original.width || height !== original.height;
    if (resized && edit.indexes === void 0) {
      throw new Error("Resizing requires replacement indexed pixels.");
    }
    if (palette.length !== original.palette.length) {
      throw new Error("Palette edit must preserve slot count.");
    }
    const indexes = edit.indexes ?? original.indexes;
    const next = { width, height, palette, indexes };
    validateIndexed(next, image.bitDepth, image._limits.maxPixels);
    if (options.validateIndexed !== void 0) {
      if (typeof options.validateIndexed !== "function") {
        throw new TypeError("validateIndexed must be a function.");
      }
      options.validateIndexed({ width, height, indexes });
    }
    const retained = new Set(edit.preserveChunks ?? []);
    for (const type of retained) {
      if (typeof type !== "string" || !/^[a-z][A-Za-z][A-Z][A-Za-z]$/.test(type) || ANIMATION_CHUNKS.has(type)) {
        throw new Error(`Invalid preserved ancillary chunk '${type}'.`);
      }
    }
    let pixelsChanged = resized;
    if (!pixelsChanged) {
      for (let i = 0; i < indexes.length; i++) {
        if (indexes[i] !== original.indexes[i]) {
          pixelsChanged = true;
          break;
        }
      }
    }
    let paletteChanged = false;
    for (let i = 0; i < palette.length; i++) {
      const color = palette[i];
      const previous = original.palette[i];
      if (color[0] !== previous[0] || color[1] !== previous[1] || color[2] !== previous[2] || color[3] !== previous[3]) {
        paletteChanged = true;
        break;
      }
    }
    if (!pixelsChanged && !paletteChanged) {
      if (image.data.length > image._limits.maxOutputBytes) {
        throw new RangeError("PNG exceeds the output byte limit.");
      }
      return Uint8Array.from(image.data);
    }
    if (image.animated) {
      throw new Error("Cannot rewrite an animated PNG through the static indexed editor.");
    }
    let compressed;
    if (pixelsChanged) {
      compressed = _ImagePNG._encodeIndexedData(next, original.sourceBitDepth, options, image._limits);
    }
    const parts = [PNG_SIGNATURE];
    let wrotePixels = false;
    for (const chunk of image.chunks) {
      const { type } = chunk;
      if (type === "IHDR" && pixelsChanged) {
        parts.push(makeChunk(type, makeHeader(width, height, image.bitDepth, 3)));
      } else if (type === "PLTE" && paletteChanged) {
        parts.push(...makePaletteChunks(palette));
      } else if (type === "tRNS" && paletteChanged) {
        continue;
      } else if (type === "IDAT" && compressed !== void 0) {
        if (!wrotePixels) {
          parts.push(makeChunk(type, compressed));
          wrotePixels = true;
        }
      } else if (type === "IHDR" || type === "PLTE" || type === "tRNS" || type === "IDAT" || type === "IEND" || chunk.safeToCopy || retained.has(type)) {
        parts.push(chunk.raw);
      }
    }
    return joinChunks(parts, image._limits.maxOutputBytes);
  }
  /**
   * Rewrite an indexed PNG using rewriteIndexed().
   * @param source Original indexed PNG bytes.
   * @param edit Palette edits and optional complete pixel/canvas replacements.
   * @param options Decoder/encoder limits and optional application validation.
   * @returns Owned PNG bytes preserving palette slot identities.
   * @static
   */
  static rewriteIndexedPng(source, edit = {}, options = {}) {
    return _ImagePNG.rewriteIndexed(source, edit, options);
  }
  /**
   * Pack validated indexes into scanlines and compress them for IDAT.
   * @param image A validated indexed surface.
   * @param bitDepth Number of bits per index.
   * @param options Filtering and compression options.
   * @param limits Resolved allocation limits.
   * @returns A complete zlib stream.
   */
  static _encodeIndexedData(image, bitDepth, options, limits) {
    const rowBytes = Math.ceil(image.width * bitDepth / 8);
    return _ImagePNG._encodeRows(image.height, rowBytes, 1, (row, y) => {
      const source = y * image.width;
      if (bitDepth === 8) {
        row.set(image.indexes.subarray(source, source + image.width));
        return;
      }
      for (let x = 0, bit = 0; x < image.width; x++, bit += bitDepth) {
        row[bit >>> 3] |= image.indexes[source + x] << 8 - bitDepth - (bit & 7);
      }
    }, options, limits);
  }
  /**
   * Filter and compress rows for indexed and RGBA8 output.
   * None is the deterministic, low-CPU default. Adaptive filtering tries all five
   * predictors and selects the lowest signed-byte residual score for each row.
   * @param height Number of scanlines.
   * @param rowBytes Packed byte count per row, excluding its filter byte.
   * @param bpp Byte distance to the previous pixel for filtering.
   * @param fillRow Callback writing one unfiltered row into zero-initialized storage.
   * @param options Filtering and compression options.
   * @param limits Resolved allocation limits.
   * @returns A complete zlib stream.
   */
  static _encodeRows(height, rowBytes, bpp, fillRow, options, limits) {
    const length = height * (rowBytes + 1);
    if (!Number.isSafeInteger(length) || length > limits.maxInflatedBytes) {
      throw new RangeError("PNG exceeds the scanline byte limit.");
    }
    const filter = options.filter ?? "none";
    if (filter !== "none" && filter !== "sub" && filter !== "adaptive") {
      throw new Error("Filter must be none, sub, or adaptive.");
    }
    const level = options.level ?? 6;
    if (!Number.isSafeInteger(level) || level < 0 || level > 9) {
      throw new RangeError("Compression level must be an integer in [0, 9].");
    }
    const rows = new Uint8Array(length);
    if (filter === "none") {
      for (let y = 0; y < height; y++) {
        const offset = y * (rowBytes + 1);
        fillRow(rows.subarray(offset + 1, offset + rowBytes + 1), y);
      }
    } else {
      let current = new Uint8Array(rowBytes);
      let previous = new Uint8Array(rowBytes);
      const candidate = new Uint8Array(rowBytes);
      let firstFilter = 0;
      let lastFilter = 4;
      if (filter === "sub") {
        firstFilter = 1;
        lastFilter = 1;
      }
      for (let y = 0; y < height; y++) {
        current.fill(0);
        fillRow(current, y);
        const offset = y * (rowBytes + 1);
        let bestScore = Infinity;
        for (let type = firstFilter; type <= lastFilter; type++) {
          let score = 0;
          for (let i = 0; i < rowBytes; i++) {
            let left = 0;
            let upperLeft = 0;
            if (i >= bpp) {
              left = current[i - bpp];
              upperLeft = previous[i - bpp];
            }
            const above = previous[i];
            let predictor = 0;
            switch (type) {
              case 1:
                predictor = left;
                break;
              case 2:
                predictor = above;
                break;
              case 3:
                predictor = left + above >>> 1;
                break;
              case 4:
                predictor = paethPredictor(left, above, upperLeft);
                break;
              default:
                break;
            }
            const byte = current[i] - predictor & 255;
            candidate[i] = byte;
            if (byte < 128) {
              score += byte;
            } else {
              score += 256 - byte;
            }
          }
          if (score < bestScore) {
            bestScore = score;
            rows[offset] = type;
            rows.set(candidate, offset + 1);
          }
        }
        const temporary = previous;
        previous = current;
        current = temporary;
      }
    }
    return deflate(rows, { level });
  }
  /**
   * No filtering, direct copy.
   * @param pixels Pixels to update.
   * @param scanline Scanline to search for pixels in.
   * @param bpp Bytes Per Pixel
   * @param offset Offset
   * @param length Length
   * @returns Pixels
   */
  static unFilterNone(pixels, scanline, bpp, offset, length) {
    return unfilterScanline(0, pixels, scanline, bpp, offset, length);
  }
  /**
   * The Sub() filter transmits the difference between each byte and the value of the corresponding byte of the prior pixel.
   * Sub(x) = Raw(x) + Raw(x - bpp)
   * @param pixels Pixels to update.
   * @param scanline Scanline to search for pixels in.
   * @param bpp Bytes Per Pixel
   * @param offset Offset
   * @param length Length
   * @returns Pixels
   */
  static unFilterSub(pixels, scanline, bpp, offset, length) {
    return unfilterScanline(1, pixels, scanline, bpp, offset, length);
  }
  /**
   * The Up() filter is just like the Sub() filter except that the pixel immediately above the current pixel, rather than just to its left, is used as the predictor.
   * Up(x) = Raw(x) + Prior(x)
   * @param pixels Pixels to update.
   * @param scanline - Scanline to search for pixels in.
   * @param bpp Bytes Per Pixel
   * @param offset Offset
   * @param length Length
   * @returns Pixels
   */
  static unFilterUp(pixels, scanline, bpp, offset, length) {
    return unfilterScanline(2, pixels, scanline, bpp, offset, length);
  }
  /**
   * The Average() filter uses the average of the two neighboring pixels (left and above) to predict the value of a pixel.
   * Average(x) = Raw(x) + floor((Raw(x-bpp)+Prior(x))/2)
   * @param pixels Pixels to update.
   * @param scanline Scanline to search for pixels in.
   * @param bpp Bytes Per Pixel
   * @param offset Offset
   * @param length Length
   * @returns Pixels
   */
  static unFilterAverage(pixels, scanline, bpp, offset, length) {
    return unfilterScanline(3, pixels, scanline, bpp, offset, length);
  }
  /**
   * The Paeth() filter computes a simple linear function of the three neighboring pixels (left, above, upper left), then chooses as predictor the neighboring pixel closest to the computed value.
   * This technique was developed by Alan W. Paeth.
   * Paeth(x) = Raw(x) + PaethPredictor(Raw(x-bpp), Prior(x), Prior(x-bpp))
   * function PaethPredictor (a, b, c)
   * begin
   * ; a = left, b = above, c = upper left
   * p := a + b - c        ; initial estimate
   * pa := abs(p - a)      ; distances to a, b, c
   * pb := abs(p - b)
   * pc := abs(p - c)
   * ; return nearest of a,b,c,
   * ; breaking ties in order a,b,c.
   * if pa <= pb AND pa <= pc then return a
   * else if pb <= pc then return b
   * else return c
   * end
   * @param pixels Pixels to update.
   * @param scanline Scanline to search for pixels in.
   * @param bpp Bytes Per Pixel
   * @param offset Offset
   * @param length Length
   * @returns Pixels
   */
  static unFilterPaeth(pixels, scanline, bpp, offset, length) {
    return unfilterScanline(4, pixels, scanline, bpp, offset, length);
  }
};
var data_image_png_default = ImagePNG;

// packages/assets/src/png.ts
var ASSET_PNG_OPTIONS = Object.freeze({
  maxInputBytes: 16 * 1024 * 1024,
  maxPixels: 1024 * 1024,
  maxInflatedBytes: 5 * 1024 * 1024,
  maxOutputBytes: 16 * 1024 * 1024,
  maxChunks: 16384,
  allow16Bit: false,
  animation: "reject",
  copyInput: false
});
function readAssetPng(bytes) {
  return data_image_png_default.fromFile(bytes, ASSET_PNG_OPTIONS);
}
var pngImporter = Object.freeze({
  id: "uttori.import.png",
  version: "2.0.0",
  mediaTypes: ["image/png"],
  import: (input) => {
    const image = readAssetPng(input.bytes);
    if (image.colorType === 3) {
      const value2 = image.toIndexed({ copy: false });
      return { kind: value2.kind, value: value2 };
    }
    const surface = image.toRGBA({ copy: false });
    const value = {
      kind: "rgba-image",
      width: surface.width,
      height: surface.height,
      rgba: surface.rgba
    };
    return { kind: value.kind, value };
  }
});

// packages/assets/src/validation.ts
function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
  return value;
}

// packages/assets/src/indexed-edit.ts
function validateIndexedPixels(image) {
  integer(image.width, "Indexed width", 1, 1 << 20);
  integer(image.height, "Indexed height", 1, 1 << 20);
  if (image.width * image.height > 1 << 20 || !(image.indexes instanceof Uint8Array) || image.indexes.length !== image.width * image.height) {
    throw new RangeError("Indexed pixels are missing or exceed the one-megapixel limit.");
  }
}

// packages/assets/src/png-edit.ts
function rewriteIndexedPng(source, edit) {
  return data_image_png_default.rewriteIndexed(source, edit, {
    ...ASSET_PNG_OPTIONS,
    filter: "none",
    level: 6,
    validateIndexed: validateIndexedPixels
  });
}

// packages/vscode-extension/src/assets/png-worker.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isWorkerBytes(value) {
  return isRecord(value) && value.bytes instanceof Uint8Array && (value.indexes === void 0 || value.indexes instanceof Uint8Array);
}
try {
  const data = import_node_worker_threads.workerData;
  if (!isWorkerBytes(data)) {
    throw new Error(
      isRecord(data) && data.indexes !== void 0 ? "PNG worker indexes must be bytes." : "PNG worker requires image bytes."
    );
  }
  const { bytes, indexes } = data;
  if (indexes) {
    import_node_worker_threads.parentPort.postMessage({ value: rewriteIndexedPng(bytes, { indexes }) });
  } else {
    const result = pngImporter.import({ bytes, mediaType: "image/png" });
    if (result.kind !== "indexed-image") {
      throw new Error(
        "This editor requires an indexed PNG. Convert truecolor images explicitly in an image tool first."
      );
    }
    import_node_worker_threads.parentPort.postMessage({ value: result.value });
  }
} catch (error) {
  import_node_worker_threads.parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) });
}
