object FrmLogin: TFrmLogin
  Left = 0
  Top = 0
  BorderStyle = bsDialog
  Caption = 'PDV Pizzaria - Login'
  ClientHeight = 250
  ClientWidth = 400
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  Position = poScreenCenter
  TextHeight = 15
  object Panel1: TPanel
    Left = 40
    Top = 30
    Width = 320
    Height = 180
    TabOrder = 0
    object Label1: TLabel
      Left = 24
      Top = 24
      Width = 32
      Height = 15
      Caption = 'E-mail'
    end
    object Label2: TLabel
      Left = 24
      Top = 72
      Width = 32
      Height = 15
      Caption = 'Senha'
    end
    object edtEmail: TEdit
      Left = 24
      Top = 40
      Width = 270
      Height = 23
      TabOrder = 0
    end
    object edtPass: TEdit
      Left = 24
      Top = 88
      Width = 270
      Height = 23
      PasswordChar = '*'
      TabOrder = 1
    end
    object btnLogin: TButton
      Left = 138
      Top = 136
      Width = 75
      Height = 25
      Caption = 'Entrar'
      Default = True
      TabOrder = 2
      OnClick = btnLoginClick
    end
    object btnCancel: TButton
      Left = 219
      Top = 136
      Width = 75
      Height = 25
      Caption = 'Cancelar'
      TabOrder = 3
      OnClick = btnCancelClick
    end
  end
end
