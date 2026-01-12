#!/bin/bash
#
# Google AI Studio からフロントエンドファイルをダウンロード＆3-wayマージするスクリプト
#
# 使い方:
#   ./scripts/ais-pull.sh           # ダウンロード＆差分表示
#   ./scripts/ais-pull.sh --force   # 確認なしで実行
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOWNLOAD_SCRIPT="$SCRIPT_DIR/download-from-drive.py"
TEMP_DIR=$(mktemp -d)
DOWNLOAD_PATH="$TEMP_DIR/nostrcube_latest.zip"
SYNC_HASH_FILE=".ais-sync-hash"

# オプション解析
FORCE=false

for arg in "$@"; do
    case $arg in
        --force)
            FORCE=true
            ;;
        -h|--help)
            echo "使い方: $0 [オプション]"
            echo ""
            echo "オプション:"
            echo "  --force   確認なしで実行"
            echo "  -h        このヘルプを表示"
            exit 0
            ;;
    esac
done

# 取り込み対象のフロントエンドファイル/ディレクトリ
FRONTEND_FILES=(
    "App.tsx"
    "index.html"
    "index.tsx"
    "types.ts"
    "components"
    "config"
    "hooks"
    "lib"
    "pages"
    "services"
    "utils"
    "shared"
)

echo "=== Google AI Studio Pull (3-way merge) ==="
echo ""

# Step 1: ダウンロード
echo "[1/4] Google Driveから最新版をダウンロード中..."
if [ ! -f "$DOWNLOAD_SCRIPT" ]; then
    echo "エラー: ダウンロードスクリプトが見つかりません: $DOWNLOAD_SCRIPT"
    rm -rf "$TEMP_DIR"
    exit 1
fi

python3 "$DOWNLOAD_SCRIPT" "$DOWNLOAD_PATH"
echo ""

# Step 2: 解凍
echo "[2/4] ZIPを解凍中..."
EXTRACT_DIR="$TEMP_DIR/extracted"
mkdir -p "$EXTRACT_DIR"
unzip -q "$DOWNLOAD_PATH" -d "$EXTRACT_DIR"

# 同期ハッシュの確認
SYNC_HASH_PATH="$EXTRACT_DIR/$SYNC_HASH_FILE"
BASE_COMMIT=""

if [ -f "$SYNC_HASH_PATH" ]; then
    SYNCED_HASH=$(cat "$SYNC_HASH_PATH" | grep '"hash"' | sed 's/.*"hash": "\([^"]*\)".*/\1/')
    SYNCED_SHORT=$(cat "$SYNC_HASH_PATH" | grep '"short"' | sed 's/.*"short": "\([^"]*\)".*/\1/')
    SYNCED_MSG=$(cat "$SYNC_HASH_PATH" | grep '"message"' | sed 's/.*"message": "\([^"]*\)".*/\1/')
    SYNCED_AT=$(cat "$SYNC_HASH_PATH" | grep '"syncedAt"' | sed 's/.*"syncedAt": "\([^"]*\)".*/\1/')

    echo ""
    echo "AI Studio側の同期ベース:"
    echo "   コミット: $SYNCED_SHORT ($SYNCED_MSG)"
    echo "   同期日時: $SYNCED_AT"
    echo ""

    # ベースコミットが存在するか確認
    if git -C "$PROJECT_DIR" cat-file -e "$SYNCED_HASH^{commit}" 2>/dev/null; then
        BASE_COMMIT="$SYNCED_HASH"
        echo "✓ ベースコミットがローカルに存在します（3-wayマージ可能）"
    else
        echo "⚠ ベースコミットがローカルに見つかりません（上書きモードで続行）"
    fi

    # 現在のHEADと比較
    CURRENT_HASH=$(cd "$PROJECT_DIR" && git rev-parse HEAD)

    if [ "$SYNCED_HASH" != "$CURRENT_HASH" ]; then
        echo ""
        echo "ローカルの変更（sync後のコミット）:"
        git -C "$PROJECT_DIR" log --oneline "$SYNCED_HASH..HEAD" 2>/dev/null | head -10 || echo "   (履歴取得エラー)"
        echo ""

        LOCAL_COMMIT_COUNT=$(git -C "$PROJECT_DIR" rev-list --count "$SYNCED_HASH..HEAD" 2>/dev/null || echo "?")
        echo "   -> $LOCAL_COMMIT_COUNT 件のコミットがローカルで追加されています"
        echo ""
    else
        echo "ローカルはAI Studioと同じコミット位置です"
        echo ""
    fi
else
    echo "同期履歴ファイル(.ais-sync-hash)が見つかりません"
    echo ""
fi

# Step 3: 差分確認
echo "[3/4] 差分を確認中..."
echo ""

HAS_DIFF=false
DIFF_FILES=()

for item in "${FRONTEND_FILES[@]}"; do
    SOURCE="$EXTRACT_DIR/$item"
    DEST="$PROJECT_DIR/$item"

    if [ -e "$SOURCE" ]; then
        if [ -d "$SOURCE" ]; then
            DIFF_OUTPUT=$(diff -rq "$SOURCE" "$DEST" 2>/dev/null || true)
            if [ -n "$DIFF_OUTPUT" ]; then
                HAS_DIFF=true
                echo "$item/ に変更があります"
                # 変更されたファイルを収集
                while IFS= read -r line; do
                    if [[ "$line" == *"differ"* ]]; then
                        FILE_PATH=$(echo "$line" | sed 's/Files \(.*\) and .* differ/\1/')
                        REL_PATH="${FILE_PATH#$EXTRACT_DIR/}"
                        DIFF_FILES+=("$REL_PATH")
                    fi
                done <<< "$DIFF_OUTPUT"
            fi
        else
            if ! diff -q "$SOURCE" "$DEST" > /dev/null 2>&1; then
                HAS_DIFF=true
                echo "$item に変更があります"
                DIFF_FILES+=("$item")
            fi
        fi
    fi
done

if [ "$HAS_DIFF" = false ]; then
    echo "変更はありません。"
    rm -rf "$TEMP_DIR"
    exit 0
fi

echo ""
echo "変更ファイル数: ${#DIFF_FILES[@]}"
echo ""

# コピー確認
if [ "$FORCE" = false ]; then
    echo "---"
    read -p "上記の変更を取り込みますか？ (y/n): " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "キャンセルしました。"
        rm -rf "$TEMP_DIR"
        exit 0
    fi
fi

# Step 4: 3-wayマージまたは上書き
echo ""
echo "[4/4] ファイルをマージ中..."
echo ""

MERGE_CONFLICTS=0
MERGED_FILES=0
OVERWRITTEN_FILES=0

# ベースコミットのファイルを取得する一時ディレクトリ
BASE_DIR="$TEMP_DIR/base"
mkdir -p "$BASE_DIR"

for file in "${DIFF_FILES[@]}"; do
    SOURCE="$EXTRACT_DIR/$file"
    DEST="$PROJECT_DIR/$file"

    # ディレクトリの場合はスキップ
    if [ -d "$SOURCE" ]; then
        continue
    fi

    # ファイルが存在しない場合は単純コピー
    if [ ! -f "$DEST" ]; then
        mkdir -p "$(dirname "$DEST")"
        cp "$SOURCE" "$DEST"
        echo "  + $file (新規)"
        MERGED_FILES=$((MERGED_FILES + 1))
        continue
    fi

    # 3-wayマージ可能な場合
    if [ -n "$BASE_COMMIT" ]; then
        # ベースファイルを取得
        BASE_FILE="$BASE_DIR/$file"
        mkdir -p "$(dirname "$BASE_FILE")"

        if git -C "$PROJECT_DIR" show "$BASE_COMMIT:$file" > "$BASE_FILE" 2>/dev/null; then
            # 3-wayマージ実行
            MERGE_RESULT=$(mktemp)

            if git merge-file -p "$DEST" "$BASE_FILE" "$SOURCE" > "$MERGE_RESULT" 2>/dev/null; then
                # マージ成功（コンフリクトなし）
                cp "$MERGE_RESULT" "$DEST"
                echo "  ✓ $file (3-wayマージ成功)"
                MERGED_FILES=$((MERGED_FILES + 1))
            else
                # コンフリクト発生
                cp "$MERGE_RESULT" "$DEST"
                echo "  ⚠ $file (コンフリクト - 手動解決が必要)"
                MERGE_CONFLICTS=$((MERGE_CONFLICTS + 1))
            fi

            rm -f "$MERGE_RESULT"
        else
            # ベースファイルが存在しない場合は上書き
            cp "$SOURCE" "$DEST"
            echo "  → $file (上書き - ベースなし)"
            OVERWRITTEN_FILES=$((OVERWRITTEN_FILES + 1))
        fi
    else
        # 3-wayマージ不可能な場合は上書き
        cp "$SOURCE" "$DEST"
        echo "  → $file (上書き)"
        OVERWRITTEN_FILES=$((OVERWRITTEN_FILES + 1))
    fi
done

# クリーンアップ
rm -rf "$TEMP_DIR"

echo ""
echo "=== Pull完了 ==="
echo ""
echo "  マージ成功: $MERGED_FILES ファイル"
echo "  上書き: $OVERWRITTEN_FILES ファイル"

if [ $MERGE_CONFLICTS -gt 0 ]; then
    echo "  ⚠ コンフリクト: $MERGE_CONFLICTS ファイル"
    echo ""
    echo "コンフリクトを手動で解決してください。"
    echo "コンフリクトマーカー: <<<<<<< / ======= / >>>>>>>"
fi

echo ""
echo "次の手順:"
echo "  1. git diff で変更内容を確認"
echo "  2. git add -A && git commit -m \"feat: sync from Google AI Studio\""
echo ""
