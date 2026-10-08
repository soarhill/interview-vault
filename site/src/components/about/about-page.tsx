import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  Mail,
  MessageSquare,
  PenLine,
  Quote,
  Database,
} from "lucide-react";
import { SiteHeader, REPO_URL } from "../shared/brand";
import { GithubIcon } from "../shared/github-icon";
import { CopyButton } from "../detail/copy-button";
import { CopyProvider } from "@/hooks/use-copy";
import { useLibrary } from "@/hooks/use-library";
import {
  SUBMISSION_EMAIL,
  SUBMISSION_MAILTO,
  SUBMISSION_TEMPLATE,
} from "@/lib/submission";
import styles from "./about.module.css";

export function AboutPage() {
  const library = useLibrary();
  const data = library.status === "success" ? library.data : undefined;
  useEffect(() => {
    document.title = `关于 / 反馈｜面个 Offer`;
    return () => {
      document.title = "面个 Offer｜真实大厂面试问题";
    };
  }, []);
  return (
    <CopyProvider>
      <div className={styles.layout}>
      <SiteHeader />
      <main className={styles.page}>
        <div className={styles.column}>
          <header className={styles.hero}>
            <h1>关于「面个 Offer」</h1>
            <p className={styles.mission}>
              <span>把真实的经历留下来，</span>
              <span>让后来的人少走一点弯路。</span>
            </p>
            <div className={styles.intro}>
              <p>面试这件事，很多时候难的不是完全不会，而是不知道会遇到什么。</p>
              <p>
                所以，我们做了这样一个简单的地方：把真实面试里出现过的问题、追问和面试过程一点点留下来。让准备下一场面试的人，多一点参考，也多一点底气。
              </p>
            </div>
          </header>

          <section className={styles.section} aria-labelledby="about-possibilities">
            <h2 id="about-possibilities" className={styles.sectionTitle}>在这里，你可以</h2>
            <div className={styles.features}>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>
                  <BookOpenText size={24} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div className={styles.featureCopy}>
                  <h3>给下一场面试，找一点参考</h3>
                  <p>按公司、岗位找到真实面经，看看真实面试里出现过的问题、追问和面试过程。</p>
                  <Link className={styles.textLink} to="/">
                    去浏览面经 <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>
                  <PenLine size={24} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div className={styles.featureCopy}>
                  <h3>把你经历过的面试，留下来</h3>
                  <p>
                    一面、二面、HR 面，还有那些记得的问题与追问。不用写成一篇完整的文章，<strong>记得多少，就分享多少。</strong>
                  </p>
                  <div className={styles.featureActions}>
                    <CopyButton
                      text={SUBMISSION_TEMPLATE}
                      label="复制投稿模板"
                      accessibleLabel="复制投稿模板"
                    />
                    <a className={styles.textLink} href={SUBMISSION_MAILTO}>
                      直接写邮件 <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  </div>
                  <p className={styles.featureMail}>
                    投稿邮箱：{SUBMISSION_EMAIL}（邮件里粘贴模板填写即可）
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.note} aria-labelledby="about-sharing">
            <Quote className={styles.quoteIcon} size={32} strokeWidth={1.5} aria-hidden="true" />
            <h2 id="about-sharing">一份经历，也许真的会帮到别人</h2>
            <p>你今天记下的一道题，也许正好是另一个人明天面试前正在寻找的参考。</p>
            <p className={styles.noteClosing}>
              当它被留下、被搜索、被后来的人看到，这次经历就多了一点意义。
            </p>
          </section>

          <section className={styles.section} aria-labelledby="about-data">
            <div className={styles.sectionHeading}>
              <h2 id="about-data" className={styles.sectionTitle}>数据说明</h2>
            </div>
            <div className={styles.dataNote}>
              <p>
                <Database size={14} aria-hidden="true" />{" "}
                本站面经来自两个渠道：整理自牛客（nowcoder.com）等公开分享的内容，以及用户通过邮箱投稿的经历（经整理审核后发布）。每份面经的详情页都保留原始来源链接；仅收录问题、追问与面试过程等文本信息，不含任何个人隐私。
                {data && <>当前数据快照生成于 {data.generatedAt.slice(0, 10)}，共 {data.total} 份面经。</>}
              </p>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="about-participate">
            <div className={styles.sectionHeading}>
              <h2 id="about-participate" className={styles.sectionTitle}>一起把它做得更好</h2>
            </div>
            <div className={styles.actions}>
              <a className={styles.actionRow} href={SUBMISSION_MAILTO}>
                <span className={styles.actionIcon}><Mail size={22} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className={styles.actionCopy}>
                  <span className={styles.actionTitle}>投稿面经 <span className={styles.actionDestination}>邮箱投稿</span></span>
                  <span className={styles.actionDescription}>把你的面试经历发到 {SUBMISSION_EMAIL}，整理审核后会在这里发布。</span>
                </span>
                <ArrowUpRight className={styles.actionArrow} size={20} aria-hidden="true" />
              </a>
              <a className={styles.actionRow} href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <span className={styles.actionIcon}><GithubIcon size={22} /></span>
                <span className={styles.actionCopy}>
                  <span className={styles.actionTitle}>GitHub · 开源仓库</span>
                  <span className={styles.actionDescription}>项目完全开源，欢迎 Star、Fork，或一起把它做得更好。</span>
                </span>
                <ArrowUpRight className={styles.actionArrow} size={20} aria-hidden="true" />
              </a>
              <a className={styles.actionRow} href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
                <span className={styles.actionIcon}><MessageSquare size={22} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className={styles.actionCopy}>
                  <span className={styles.actionTitle}>反馈与建议 <span className={styles.actionDestination}>GitHub Issues</span></span>
                  <span className={styles.actionDescription}>发现 Bug、数据问题，或者有新的想法，都欢迎告诉我们。</span>
                </span>
                <ArrowUpRight className={styles.actionArrow} size={20} aria-hidden="true" />
              </a>
            </div>
          </section>

          <footer className={styles.footer}>
            <span>Built by <a href="https://github.com/soarhill" target="_blank" rel="noopener noreferrer">@soarhill</a></span>
            <Link to="/"><ArrowLeft size={15} aria-hidden="true" /> 回到面经列表</Link>
          </footer>
        </div>
      </main>
      </div>
    </CopyProvider>
  );
}
