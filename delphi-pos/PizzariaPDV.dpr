program PizzariaPDV;

uses
  Vcl.Forms,
  MainForm in 'MainForm.pas' {FrmMain},
  Login in 'Login.pas' {FrmLogin},
  APIClient in 'APIClient.pas';

{$R *.res}

begin
  Application.Initialize;
  Application.MainFormOnTaskbar := True;
  
  // Exibir a tela de login primeiro
  FrmLogin := TFrmLogin.Create(Application);
  if FrmLogin.ShowModal = mrOk then
  begin
    FrmLogin.Free;
    Application.CreateForm(TFrmMain, FrmMain);
    Application.Run;
  end
  else
  begin
    FrmLogin.Free;
    Application.Terminate;
  end;
end.
