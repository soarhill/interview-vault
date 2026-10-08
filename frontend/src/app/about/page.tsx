import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  ChevronDown,
  Coffee,
  MessageSquare,
  PenLine,
  Quote,
} from "lucide-react";
import { SiteHeader } from "@/components/shared/brand";
import { GithubIcon } from "@/components/shared/github-icon";
import { SupportCode } from "./support-code";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "关于 / 反馈｜面个 Offer",
  description:
    "把真实的经历留下来，让后来的人少走一点弯路。了解面个 Offer，参与开源、提出建议或支持作者。",
};

const REPO = "https://github.com/soarhill/interview-vault";

export default function AboutPage() {
  return (
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
                  <Link className={styles.textLink} href="/">
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
                  <Link className={styles.textLink} href="/me/interviews/new">
                    去分享经历 <ArrowRight size={16} aria-hidden="true" />
                  </Link>
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

          <section className={styles.section} aria-labelledby="about-participate">
            <div className={styles.sectionHeading}>
              <h2 id="about-participate" className={styles.sectionTitle}>一起把它做得更好</h2>
            </div>
            <div className={styles.actions}>
              <a className={styles.actionRow} href={REPO} target="_blank" rel="noopener noreferrer">
                <span className={styles.actionIcon}><GithubIcon size={22} /></span>
                <span className={styles.actionCopy}>
                  <span className={styles.actionTitle}>GitHub · 开源仓库</span>
                  <span className={styles.actionDescription}>项目完全开源，欢迎 Star、Fork，或一起把它做得更好。</span>
                </span>
                <ArrowUpRight className={styles.actionArrow} size={20} aria-hidden="true" />
              </a>
              <a className={styles.actionRow} href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">
                <span className={styles.actionIcon}><MessageSquare size={22} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className={styles.actionCopy}>
                  <span className={styles.actionTitle}>反馈与建议 <span className={styles.actionDestination}>GitHub Issues</span></span>
                  <span className={styles.actionDescription}>发现 Bug、数据问题，或者有新的想法，都欢迎告诉我们。</span>
                </span>
                <ArrowUpRight className={styles.actionArrow} size={20} aria-hidden="true" />
              </a>
            </div>
          </section>

          <section className={styles.support} aria-labelledby="about-support">
            <div className={styles.supportHeading}>
              <Coffee size={21} strokeWidth={1.6} aria-hidden="true" />
              <h2 id="about-support">请作者喝杯咖啡</h2>
            </div>
            <p>如果面个 Offer 曾经给你带来过一点帮助，也可以请作者喝杯咖啡。</p>
            <p className={styles.supportDisclaimer}>赞赏完全自愿，不影响任何功能，也不会获得额外权益。</p>
            <details className={styles.supportCodes}>
              <summary>查看赞赏码 <ChevronDown size={15} aria-hidden="true" /></summary>
              <div className={styles.codeGrid}>
                <SupportCode
                  src="/support/wechat-pay.jpg"
                  alt="微信自愿赞赏二维码，点击查看原图"
                  label="微信"
                />
                <SupportCode
                  src="/support/alipay.jpg"
                  alt="支付宝自愿赞赏二维码，点击查看原图"
                  label="支付宝"
                />
              </div>
            </details>
          </section>

          <footer className={styles.footer}>
            <span>Built by <a href="https://github.com/soarhill" target="_blank" rel="noopener noreferrer">@soarhill</a></span>
            <Link href="/"><ArrowLeft size={15} aria-hidden="true" /> 回到面经列表</Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
