#!/bin/bash
#
# Google AI Studio プロジェクトにファイルを同期するスクリプト
#
# 使い方:
#   ./scripts/sync-to-ai-studio.sh <AI StudioからダウンロードしたZIPファイルのパス>
#
# 例:
#   ./scripts/sync-to-ai-studio.sh ~/Downloads/"product"
#
# 実行後:
#   1. Google Driveでプロジェクトファイルを右クリック
#   2. 「バージョンを管理」をクリック
#   3. 「新しいバージョンをアップロード」で出力ファイルを選択
#

set -e

# 引数チェック
if [ -z "$1" ]; then
    echo "使い方: $0 <AI StudioからダウンロードしたZIPファイルのパス>"
    echo "例: $0 ~/Downloads/\"product\""
    exit 1
fi

INPUT_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORK_DIR=$(mktemp -d)
INPUT_DIR="$(cd "$(dirname "$INPUT_FILE")" && pwd)"
INPUT_BASENAME="$(basename "$INPUT_FILE")"
OUTPUT_DIR="${INPUT_DIR}/${INPUT_BASENAME}-updated"
OUTPUT_FILE="${OUTPUT_DIR}/${INPUT_BASENAME}"
mkdir -p "$OUTPUT_DIR"

echo "=== Google AI Studio Sync Script ==="
echo ""
echo "入力ファイル: $INPUT_FILE"
echo "出力ファイル: $OUTPUT_FILE"
echo ""

# Step 1: 解凍してmetadata.jsonを取得
echo "[1/3] ZIPを解凍中..."
unzip -q "$INPUT_FILE" -d "$WORK_DIR"

# metadata.jsonをバックアップして、それ以外を全削除
cp "$WORK_DIR/metadata.json" "$WORK_DIR/metadata.json.bak"
find "$WORK_DIR" -mindepth 1 -maxdepth 1 ! -name 'metadata.json.bak' -exec rm -rf {} +
mv "$WORK_DIR/metadata.json.bak" "$WORK_DIR/metadata.json"

# Step 2: GitHubのファイルをコピー
echo "[2/3] ファイルをコピー中..."

# version.json（ビルド情報）
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_ID=$(date -u +"%Y%m%d%H%M%S")
VERSION=$(cat "$PROJECT_DIR/package.json" | grep '"version"' | head -1 | sed 's/.*"version": "\(.*\)".*/\1/' || echo "0.0.0")

cat > "$WORK_DIR/version.json" << VERSIONEOF
{
  "version": "$VERSION",
  "buildTime": "$BUILD_TIME",
  "buildId": "$BUILD_ID"
}
VERSIONEOF

echo "  バージョン情報: v$VERSION (build: $BUILD_ID)"

# フロントエンドファイル
cp "$PROJECT_DIR/App.tsx" "$WORK_DIR/"
cp "$PROJECT_DIR/index.html" "$WORK_DIR/"
cp "$PROJECT_DIR/index.tsx" "$WORK_DIR/"
cp "$PROJECT_DIR/types.ts" "$WORK_DIR/"
cp "$PROJECT_DIR/tsconfig.json" "$WORK_DIR/"
cp "$PROJECT_DIR/vite.config.ts" "$WORK_DIR/"
cp -rf "$PROJECT_DIR/components" "$WORK_DIR/"
cp -rf "$PROJECT_DIR/services" "$WORK_DIR/"
cp -rf "$PROJECT_DIR/scripts" "$WORK_DIR/"
rm -rf $WORK_DIR/scripts/.venv

# バックエンド
#cp -rf "$PROJECT_DIR/.github" "$WORK_DIR/"

# Step 3: ZIP作成
echo "[3/3] ZIP作成中..."
rm -f "$OUTPUT_FILE"
(cd "$WORK_DIR" && zip -rq "${OUTPUT_FILE}.zip" . -x ".DS_Store" -x "__MACOSX/*")
mv "${OUTPUT_FILE}.zip" "$OUTPUT_FILE"

# クリーンアップ
rm -rf "$WORK_DIR"

echo ""
echo "=== 完了 ==="
echo ""
echo "出力ファイル: $OUTPUT_FILE"
echo ""

# 自動アップロードの試行
CREDENTIALS_JSON="$PROJECT_DIR/credentials.json"
UPLOAD_SCRIPT="$SCRIPT_DIR/upload-to-drive.py"

if [ -f "$CREDENTIALS_JSON" ] && [ -f "$UPLOAD_SCRIPT" ]; then
    echo "=== Google Driveへの自動アップロード ==="
    echo "credentials.json を検出しました。アップロードを試みます..."
    
    # 必要なライブラリのチェック
    if python3 -c "import googleapiclient" 2>/dev/null; then
        python3 "$UPLOAD_SCRIPT" "$OUTPUT_FILE"
        echo ""
        echo "✅ アップロード完了"
    else
        echo "⚠️  Pythonライブラリが見つかりません。"
        echo "以下のコマンドを実行してインストールしてください:"
        echo "pip3 install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
    fi
else
    echo "次の手順:"
    echo "  1. Google Driveでプロジェクトファイルを右クリック"
    echo "  2. 「バージョンを管理」をクリック"
    echo "  3. 「新しいバージョンをアップロード」で以下を選択:"
    echo "     $OUTPUT_FILE"
fi
echo ""
