unit Login;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Variants, System.Classes, Vcl.Graphics,
  Vcl.Controls, Vcl.Forms, Vcl.Dialogs, Vcl.StdCtrls, Vcl.ExtCtrls;

type
  TFrmLogin = class(TForm)
    Panel1: TPanel;
    edtEmail: TEdit;
    edtPass: TEdit;
    Label1: TLabel;
    Label2: TLabel;
    btnLogin: TButton;
    btnCancel: TButton;
    procedure btnLoginClick(Sender: TObject);
    procedure btnCancelClick(Sender: TObject);
  private
    { Private declarations }
  public
    { Public declarations }
  end;

var
  FrmLogin: TFrmLogin;

implementation

{$R *.dfm}

uses APIClient;

procedure TFrmLogin.btnCancelClick(Sender: TObject);
begin
  ModalResult := mrCancel;
end;

procedure TFrmLogin.btnLoginClick(Sender: TObject);
begin
  if GlobalAPI.Login(edtEmail.Text, edtPass.Text) then
  begin
    ModalResult := mrOk;
  end
  else
  begin
    ShowMessage('Falha no Login. Verifique credenciais e conexão.');
  end;
end;

end.
