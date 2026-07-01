object FrmMain: TFrmMain
  Left = 0
  Top = 0
  Caption = 'PDV Pizzaria - Caixa'
  ClientHeight = 600
  ClientWidth = 1000
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  Position = poScreenCenter
  WindowState = wsMaximized
  OnCreate = FormCreate
  TextHeight = 15
  object PanelTop: TPanel
    Left = 0
    Top = 0
    Width = 1000
    Height = 60
    Align = alTop
    Color = clNavy
    ParentBackground = False
    TabOrder = 0
    object lblTitle: TLabel
      Left = 16
      Top = 16
      Width = 188
      Height = 25
      Caption = 'PDV R'#225'pido - Caixa 01'
      Font.Charset = DEFAULT_CHARSET
      Font.Color = clWhite
      Font.Height = -19
      Font.Name = 'Segoe UI'
      Font.Style = [fsBold]
      ParentFont = False
    end
  end
  object PanelLeft: TPanel
    Left = 0
    Top = 60
    Width = 200
    Height = 540
    Align = alLeft
    TabOrder = 1
    object lbCategories: TListBox
      Left = 1
      Top = 1
      Width = 198
      Height = 538
      Align = alClient
      ItemHeight = 30
      Items.Strings = (
        'Pizzas Tradicionais'
        'Bebidas'
        'Sobremesas')
      TabOrder = 0
    end
  end
  object PanelCenter: TPanel
    Left = 200
    Top = 60
    Width = 500
    Height = 540
    Align = alClient
    TabOrder = 2
    object GridProducts: TStringGrid
      Left = 1
      Top = 1
      Width = 498
      Height = 538
      Align = alClient
      FixedCols = 0
      Options = [goFixedVertLine, goFixedHorzLine, goVertLine, goHorzLine, goRangeSelect, goRowSelect]
      TabOrder = 0
      OnDblClick = GridProductsDblClick
    end
  end
  object PanelRight: TPanel
    Left = 700
    Top = 60
    Width = 300
    Height = 540
    Align = alRight
    TabOrder = 3
    object lblTotal: TLabel
      Left = 16
      Top = 380
      Width = 127
      Height = 30
      Caption = 'Total: R$ 0,00'
      Font.Charset = DEFAULT_CHARSET
      Font.Color = clWindowText
      Font.Height = -21
      Font.Name = 'Segoe UI'
      Font.Style = [fsBold]
      ParentFont = False
    end
    object lbCart: TListBox
      Left = 1
      Top = 1
      Width = 298
      Height = 360
      Align = alTop
      ItemHeight = 15
      TabOrder = 0
    end
    object btnPay: TButton
      Left = 16
      Top = 424
      Width = 265
      Height = 40
      Caption = 'Pagar (F12)'
      Font.Charset = DEFAULT_CHARSET
      Font.Color = clWindowText
      Font.Height = -16
      Font.Name = 'Segoe UI'
      Font.Style = [fsBold]
      ParentFont = False
      TabOrder = 1
    end
    object btnCancel: TButton
      Left = 16
      Top = 480
      Width = 265
      Height = 40
      Caption = 'Cancelar (ESC)'
      TabOrder = 2
    end
  end
end
