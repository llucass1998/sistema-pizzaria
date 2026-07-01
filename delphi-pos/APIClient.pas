unit APIClient;

interface

uses
  System.SysUtils, System.Classes, System.JSON, REST.Client, REST.Types, System.Net.HttpClient;

type
  TAPIClient = class
  private
    FBaseURL: string;
    FToken: string;
    FRESTClient: TRESTClient;
    FRESTRequest: TRESTRequest;
    FRESTResponse: TRESTResponse;
  public
    constructor Create(const ABaseURL: string);
    destructor Destroy; override;
    
    function Login(const Email, Password: string): Boolean;
    function GetProducts: TJSONArray;
    
    property Token: string read FToken write FToken;
  end;

var
  GlobalAPI: TAPIClient;

implementation

constructor TAPIClient.Create(const ABaseURL: string);
begin
  FBaseURL := ABaseURL;
  FRESTClient := TRESTClient.Create(FBaseURL);
  FRESTResponse := TRESTResponse.Create(nil);
  FRESTRequest := TRESTRequest.Create(nil);
  FRESTRequest.Client := FRESTClient;
  FRESTRequest.Response := FRESTResponse;
end;

destructor TAPIClient.Destroy;
begin
  FRESTRequest.Free;
  FRESTResponse.Free;
  FRESTClient.Free;
  inherited;
end;

function TAPIClient.Login(const Email, Password: string): Boolean;
var
  JSONBody: TJSONObject;
begin
  Result := False;
  FRESTRequest.Resource := 'admins/login';
  FRESTRequest.Method := rmPOST;
  FRESTRequest.ClearBody;
  
  JSONBody := TJSONObject.Create;
  try
    JSONBody.AddPair('email', Email);
    JSONBody.AddPair('password', Password);
    FRESTRequest.AddBody(JSONBody.ToString, ctAPPLICATION_JSON);
    
    FRESTRequest.Execute;
    
    if (FRESTResponse.StatusCode = 200) then
    begin
      // Na vida real, o token vem via HttpOnly Cookie (precisa configurar o CookieManager do TRESTClient)
      // ou no body como fallback para clientes não-web.
      Result := True;
    end;
  finally
    JSONBody.Free;
  end;
end;

function TAPIClient.GetProducts: TJSONArray;
begin
  FRESTRequest.Resource := 'produtos';
  FRESTRequest.Method := rmGET;
  FRESTRequest.ClearBody;
  FRESTRequest.Execute;
  
  if (FRESTResponse.StatusCode = 200) and Assigned(FRESTResponse.JSONValue) then
  begin
    if FRESTResponse.JSONValue is TJSONArray then
      Result := TJSONArray(FRESTResponse.JSONValue.Clone)
    else
      Result := nil;
  end
  else
    Result := nil;
end;

initialization
  GlobalAPI := TAPIClient.Create('http://localhost:3000/api/');
finalization
  GlobalAPI.Free;
end.
