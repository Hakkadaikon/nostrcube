import os
import sys
import io
import pickle
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.http import MediaIoBaseDownload

# 権限スコープ
SCOPES = ['https://www.googleapis.com/auth/drive']

# 設定（環境変数から取得、デフォルト値あり）
TARGET_FOLDER_ID = os.environ.get('GOOGLE_DRIVE_FOLDER_ID', '1PX5ofzSyLY9ZOgOdoQAEeapOfqQy2Dg0')
FILE_NAME_PATTERN = os.environ.get('GOOGLE_DRIVE_FILE_NAME', 'nostrcube')

def main():
    if len(sys.argv) < 2:
        print("使用法: python3 scripts/download-from-drive.py <ダウンロード先パス>")
        sys.exit(1)

    output_path = sys.argv[1]
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # 認証情報のパス
    credentials_path = os.path.join(project_root, 'credentials.json')
    token_path = os.path.join(project_root, 'token.pickle')

    creds = None
    if os.path.exists(token_path):
        with open(token_path, 'rb') as token:
            try:
                creds = pickle.load(token)
            except Exception:
                pass

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                creds = None

        if not creds:
            if not os.path.exists(credentials_path):
                print(f"エラー: {credentials_path} が見つかりません。")
                sys.exit(1)

            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, 'wb') as token:
            pickle.dump(creds, token)

    try:
        service = build('drive', 'v3', credentials=creds)

        # DEBUG: フォルダ内の全ファイルを表示
        print(f"DEBUG: フォルダ ({TARGET_FOLDER_ID}) 内のファイルを検索中...")
        debug_results = service.files().list(
            q=f"'{TARGET_FOLDER_ID}' in parents and trashed = false",
            fields="files(id, name, mimeType)"
        ).execute()
        print("DEBUG: 見つかったファイル一覧:")
        for f in debug_results.get('files', []):
            print(f"  - {f['name']} (ID: {f['id']}, Type: {f['mimeType']})")
        print("--------------------------------")

        # フォルダ内の最新ファイルを検索
        # nameが一致し、かつゴミ箱に入っていないファイル。作成日時(createdTime)で降順ソート。
        query = f"'{TARGET_FOLDER_ID}' in parents and name = '{FILE_NAME_PATTERN}' and trashed = false"
        results = service.files().list(
            q=query,
            orderBy="createdTime desc",
            pageSize=1,
            fields="files(id, name, mimeType)"
        ).execute()

        items = results.get('files', [])

        if not items:
            print(f"エラー: フォルダ内に '{FILE_NAME_PATTERN}' が見つかりません。")
            sys.exit(1)

        target_file = items[0]
        file_id = target_file['id']
        print(f"ダウンロード対象: {target_file['name']} (ID: {file_id})")

        request = service.files().get_media(fileId=file_id)
        fh = io.FileIO(output_path, 'wb')
        downloader = MediaIoBaseDownload(fh, request)

        done = False
        while done is False:
            status, done = downloader.next_chunk()
            if status:
                print(f"ダウンロード中: {int(status.progress() * 100)}%")

        print(f"ダウンロード完了: {output_path}")

    except Exception as e:
        print(f"エラーが発生しました: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
