;`00 00
;`00 00
;`02 80 00
;`02 80 00
;`00 80 00
;`04 80 00
;`1B 80 00
;`16 80 00
;`00 90 00
;`00 00
;`00 00
;`00 00
;`1D 80 00
;`1D 80 00
;`04 80 00
;`04 80 00
;`3C 61 3E

org $008000
	Main:
		macro macro_with_labels()
			; 0x00 = 00 00
			?MacroMain:
				db $00,$00
			; 0x02 = 00 00
			?.MacroSub:
				db $00,$00
			?-:
			#InMacro:
			#.InMacroSub:
			; 0x04 = 02 80 00
			dl ?.MacroSub
			; 0x07 = 02 80 00
			dl ?MacroMain_MacroSub
			; 0x0A = 00 80 00
			dl -
			; 0x0D = 04 80 00
			dl ?-
			; 0x10 = 1B 80 00
			dl +
			; 0x13 = 16 80 00
			dl ?+
			?+:
			?MacroAssignment = $009000
			; 0x16 = 00 90 00
			dl ?MacroAssignment
		endmacro

	-:
		%macro_with_labels()
		; 0x19
		db $00,$00

	+:
		; 0x1B
		db $00,$00

	.Sub:
		; 0x1D
		db $00,$00

		dl .Sub
		dl Main_Sub
		dl InMacro
		dl Main_InMacroSub		; Note that this is not InMacro_InMacroSub

		; not exactly a test for macro labels, but close enough
		; 0x2B
		db "<a>" ; macro argument outside macro - should be left unexpanded
