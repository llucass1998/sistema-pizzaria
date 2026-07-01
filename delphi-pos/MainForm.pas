unit MainForm;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Variants, System.Classes, Vcl.Graphics,
  Vcl.Controls, Vcl.Forms, Vcl.Dialogs, Vcl.ExtCtrls, Vcl.StdCtrls, Vcl.Grids, System.JSON;

type
  TFrmMain = class(TForm)
    PanelTop: TPanel;
    PanelLeft: TPanel;
    PanelCenter: TPanel;
    PanelRight: TPanel;
    lblTitle: TLabel;
    lbCategories: TListBox;
    GridProducts: TStringGrid;
    lbCart: TListBox;
    lblTotal: TLabel;
    btnPay: TButton;
    btnCancel: TButton;
    procedure FormCreate(Sender: TObject);
    procedure GridProductsDblClick(Sender: TObject);
  private
    FTotal: Double;
    procedure LoadProducts;
    procedure UpdateTotal;
  public
    { Public declarations }
  end;

var
  FrmMain: TFrmMain;

implementation

{$R *.dfm}

uses APIClient;

procedure TFrmMain.FormCreate(Sender: TObject);
begin
  FTotal := 0.0;
  
  // Config Grid
  GridProducts.ColCount := 2;
  GridProducts.RowCount := 1;
  GridProducts.Cells[0, 0] := 'Produto';
  GridProducts.Cells[1, 0] := 'Preço';
  GridProducts.ColWidths[0] := 200;
  GridProducts.ColWidths[1] := 100;
  
  LoadProducts;
end;

procedure TFrmMain.LoadProducts;
var
  JArray: TJSONArray;
  I: Integer;
  JObj: TJSONObject;
begin
  JArray := GlobalAPI.GetProducts;
  if Assigned(JArray) then
  begin
    GridProducts.RowCount := JArray.Count + 1;
    for I := 0 to JArray.Count - 1 do
    begin
      JObj := JArray.Items[I] as TJSONObject;
      GridProducts.Cells[0, I + 1] := JObj.GetValue('name').Value;
      GridProducts.Cells[1, I + 1] := JObj.GetValue('price').Value;
    end;
    JArray.Free;
  end;
end;

procedure TFrmMain.GridProductsDblClick(Sender: TObject);
var
  ProdName, ProdPrice: string;
  PriceValue: Double;
begin
  if GridProducts.Row > 0 then
  begin
    ProdName := GridProducts.Cells[0, GridProducts.Row];
    ProdPrice := GridProducts.Cells[1, GridProducts.Row];
    
    if TryStrToFloat(ProdPrice, PriceValue) then
    begin
      lbCart.Items.Add(ProdName + ' - R$ ' + FloatToStrF(PriceValue, ffFixed, 8, 2));
      FTotal := FTotal + PriceValue;
      UpdateTotal;
    end;
  end;
end;

procedure TFrmMain.UpdateTotal;
begin
  lblTotal.Caption := 'Total: R$ ' + FloatToStrF(FTotal, ffFixed, 8, 2);
end;

end.
