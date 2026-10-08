/** 邮箱投稿入口（静态版不提供在线表单，投稿统一走邮箱）。 */
export const SUBMISSION_EMAIL = "3046829330@qq.com";
export const SUBMISSION_SUBJECT = "【面个 Offer】面经投稿";
export const SUBMISSION_MAILTO = `mailto:${SUBMISSION_EMAIL}?subject=${encodeURIComponent(SUBMISSION_SUBJECT)}`;

/** 一键复制的投稿模板：字段对齐站内数据模型，收到的投稿可直接整理入库。 */
export const SUBMISSION_TEMPLATE = `【面个 Offer】面经投稿

公司：
岗位：
招聘类型：（实习 / 校招）
面试时间：（如 2026-09-28；不确定可只写月份或年份）
部门（可选）：

面试轮次与问题：
  一面：
    1.
       追问：
    2.
  二面：
    1.

来源链接（如牛客帖子地址）：
`;
