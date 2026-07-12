;`ea 5c 08 80 00 ea ea ea ea ea ea 22 00 80 00 22
;`01 80 00 22 05 80 00 22 06 80 00 22 07 80 00 22
;`08 80 00 22 09 80 00 22 0a 80 00 22 0b 80 00

lorom
org $008000

namespace nested on
global label1: : nop
namespace main
    label1:
    jml label2
    namespace second
    label2: : nop
        namespace third
        label3: : nop
        .sublabel : nop
        global label2: : nop
        .sublabel : nop
        global #label3: : nop
        ..sublabel
        namespace off
    namespace off
namespace off
namespace nested off
; 0x0B = 22 00 08 00
jsl label1
; 0x0F = 22 01 80 80
jsl main_label1
; 0x13 = 22 05 80 00
jsl main_second_label2
; 0x17 = 22 06 80 00
jsl main_second_third_label3
; 0x1B = 22 07 80 00
jsl main_second_third_label3_sublabel
; 0x1F = 22 08 80 00
jsl label2
; 0x23 = 22 09 80 00
jsl main_second_third_label2_sublabel
; 0x27 = 22 0A 80 00
jsl label3
; 0x2B = 22 0B 80 00
jsl main_second_third_label2_sublabel_sublabel
