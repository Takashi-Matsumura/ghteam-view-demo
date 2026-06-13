// route（サーバ）と PrAnalysisPanel（クライアント）で共有する、
// 思考プロセスと本文の区切りマーカー。これより前=思考、後=本文。
// 副作用のない定数のみ（クライアントへ安全に import できる）。
export const ANSWER_MARKER = "__ANSWER__";
