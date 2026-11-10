import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Plus,
  Printer,
  Trash2,
  Upload,
} from "lucide-react";

const STEPS = [
  ["1", "客戶資料"],
  ["2", "工程項目"],
  ["3", "列印簽署"],
  ["4", "遞交office"],
];

const DEMO_LINES = [
  {
    category: "打拆工程",
    items: [
      {
        name: "廚房牆身／地台 清拆打鑿",
        detail: "打鑿大約2-3寸，以見到石屎為盡；清拆後廢物另外收費",
        width: 12,
        height: 8,
        unit: "尺",
        price: 5000,
      },
      {
        name: "廁所牆身／地台 清拆打鑿",
        detail: "打鑿大約2-3寸，以見到石屎為盡；清拆後廢物另外收費",
        width: 4,
        height: 8,
        unit: "尺",
        price: 3400,
      },
    ],
  },
  {
    category: "油漆工程",
    items: [
      {
        name: "全屋剷走鬆散底灰、批灰及髹油（有傢俬和雜物）",
        detail: "連工包料用立邦五合一油漆",
        width: 100,
        height: 8,
        unit: "尺",
        price: 40000,
      },
    ],
  },
];

function Progress({ step }: { step: number }) {
  return (
    <div className="quote-wizard-progress">
      {STEPS.map(([number, label], index) => {
        const done = step > index + 1;
        const active = step === index + 1;
        return (
          <div
            key={number}
            className={`quote-wizard-step ${done ? "done" : ""} ${active ? "active" : ""}`}
          >
            <span>{done ? <Check size={26} /> : number}</span>
            <strong>{label}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function QuoteWizardPreview() {
  const [step, setStep] = useState(1);
  const nav = useNavigate();
  return (
    <div className="quote-wizard">
      <header className="quote-wizard-head">
        <div>
          <h1>建立報價</h1>
          <span className="quote-preview-badge">設計預覽</span>
        </div>
        <div className="quote-wizard-actions">
          <Link className="btn" to="/quotes">
            返回
          </Link>
          <button className="btn btn-primary" type="button">
            儲存草稿
          </button>
        </div>
      </header>
      <Progress step={step} />
      {step === 1 && (
        <>
          <h2 className="quote-step-title">1. 客戶資料</h2>
          <div className="quote-step-section">
            <div className="quote-form-grid four">
              <label>客戶姓名*<input defaultValue="陳大文" /></label>
              <label>身份證號碼<input /></label>
              <label>聯絡電話<span className="quote-phone-input"><select defaultValue="+852"><option>+852</option><option>+853</option><option>+86</option></select><ChevronDown size={16} /><input placeholder="9123 4567" /></span></label>
              <label>WhatsApp電話*<span className="quote-phone-input"><select defaultValue="+852"><option>+852</option><option>+853</option><option>+86</option></select><ChevronDown size={16} /><input placeholder="9123 4567" /></span></label>
            </div>
            <div className="quote-form-grid six">
              <label>工程地區*<select defaultValue=""><option value="">選擇地區</option><option>元朗</option><option>沙田</option></select></label>
              <label>街道<input /></label>
              <label>屋苑／大廈*<input /></label>
              <label>座數／樓宇名*<input /></label>
              <label>樓層*<input /></label>
              <label>單位*<input /></label>
            </div>
            <label className="quote-form-full">完整地址顯示<input defaultValue="元朗 Demo 工程街 Demo 屋苑 31 座 11 樓 C 室" /></label>
            <div className="quote-form-grid two align-end">
              <label>Sales 備註<textarea defaultValue="" /></label>
              <label>客戶附件<div className="quote-upload-box"><Plus size={20} /> 上載圖片</div></label>
            </div>
          </div>
          <div className="quote-wizard-footer">
            <button className="btn" type="button" onClick={() => nav("/quotes")}>返回</button>
            <button className="btn" type="button" onClick={() => setStep(2)}>下一步 <ArrowRight size={18} /></button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="quote-step-title">2. 工程項目</h2>
          <div className="quote-step-section quote-step-lines">
            {DEMO_LINES.map((group) => (
              <div className="quote-category-group" key={group.category}>
                <div className="quote-category-head">{group.category}</div>
                {group.items.map((item, index) => (
                  <div className="quote-demo-line" key={item.name}>
                    <div className="quote-demo-line-top">
                      <div>
                        <strong>{index + 1}. {item.name}</strong>
                        <p>{item.detail}</p>
                        <small>HK$50.00 / 平方尺</small>
                      </div>
                      <button type="button" aria-label={`移除${item.name}`}><Trash2 size={20} /></button>
                    </div>
                    <div className="quote-demo-line-bottom">
                      <div className="quote-demo-dimensions">
                        <label>闊度 (Width)<input defaultValue={item.width} /></label>
                        <label>高度 (Height)<input defaultValue={item.height} /></label>
                        <label>單位<select defaultValue={item.unit}><option>尺</option><option>寸</option></select></label>
                      </div>
                      <strong>HK${item.price.toLocaleString()}.00</strong>
                    </div>
                  </div>
                ))}
                <div className="quote-category-total">
                  <span>工程小計</span>
                  <strong>HK${group.items.reduce((s, i) => s + i.price, 0).toLocaleString()}.00</strong>
                </div>
              </div>
            ))}
            <button className="quote-add-line" type="button"><Plus size={18} /> 新增工程</button>
            <div className="quote-demo-summary">
              <label>全單折扣<select defaultValue="amount"><option value="none">原價（不打折）</option><option value="amount">自訂扣減</option></select></label>
              <label>扣減金額 (HKD)<input defaultValue="400" /></label>
              <div>
                <span>成交金額</span>
                <strong>HK$48,000.00</strong>
              </div>
            </div>
          </div>
          <div className="quote-wizard-footer">
            <button className="btn" onClick={() => setStep(1)}>上一步</button>
            <button className="btn" onClick={() => setStep(3)}>下一步</button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <h2 className="quote-step-title">3. 列印簽署</h2>
          <div className="quote-sign-actions">
            <button className="btn btn-primary"><Printer size={18} /> 列印報價單</button>
            <button className="btn">修改報價</button>
            <button className="btn">儲存草稿</button>
            <button className="btn">封存</button>
          </div>
          <div className="quote-step-section quote-sign-grid">
            <div className="quote-sign-panel">
              <h3>報價摘要</h3>
              <label>簽署日期<input type="date" defaultValue="2026-10-22" /></label>
              <label>當日主管<select defaultValue="Don"><option>Don</option><option>世雄</option></select></label>
              <div className="quote-sign-checks">
                <strong>訂單分類</strong>
                <label><input type="checkbox" defaultChecked /> 8萬資助</label>
                <label><input type="checkbox" defaultChecked /> 團購</label>
                <label><input type="checkbox" /> 自費</label>
              </div>
              <div className="quote-sign-checks">
                <strong>訂單性質</strong>
                <label><input type="radio" name="kind" defaultChecked /> 新訂單</label>
                <label><input type="radio" name="kind" /> 加單</label>
              </div>
              <button className="btn btn-primary full-width">列印報價單</button>
            </div>
            <div className="quote-document-preview">
              <img src="/design-assets/quotation.svg" alt="報價單預覽" />
            </div>
          </div>
          <p className="quote-sign-note">請列印此版本交客人簽署，回來上載同一份已簽紙本。</p>
          <div className="quote-wizard-footer">
            <button className="btn" onClick={() => setStep(2)}>上一步</button>
            <button className="btn" onClick={() => setStep(4)}>下一步</button>
          </div>
        </>
      )}
      {step === 4 && (
        <>
          <h2 className="quote-step-title">4. 遞交office</h2>
          <div className="quote-number-line">報價單號碼：<strong>QDM260008</strong></div>
          <div className="quote-handoff-card">
            <div className="quote-handoff-title"><h3>1. 客戶簽署</h3><span>✓ 已完成</span></div>
            <div className="quote-handoff-content">
              <div>
                <p>客戶姓名：<strong>陳大文</strong></p>
                <p>聯絡電話：<strong>9432 2314</strong></p>
                <p>客戶地址：<strong>元朗 Demo 工程街 Demo 屋苑 31 座 11 樓 C 室</strong></p>
                <p>簽署日期：<strong>22 / 10 / 2026</strong></p>
                <p>當日主管：<strong>Don</strong></p>
              </div>
              <div className="quote-signed-thumb">已簽報價副本</div>
            </div>
            <div className="quote-signed-note"><Check size={16} /> 我確認客戶已簽署上述正式報價版本</div>
          </div>
          <div className="quote-handoff-card">
            <div className="quote-handoff-title"><h3>2. 登記客戶付款</h3><span>✓ 已完成</span></div>
            <div className="quote-payment-layout">
              <div className="quote-payment-fields">
                <label>付款金額 (HKD)*<input defaultValue="1500" /></label>
                <label>付款方式*<select defaultValue="cash"><option value="cash">現金</option><option value="transfer">銀行轉帳</option></select></label>
                <label>收款／保管位置<select><option>Sales保管</option><option>公司戶口</option></select></label>
                <label>收款日期<input type="date" defaultValue="2026-10-22" /></label>
              </div>
              <div className="quote-payment-upload">
                <Upload size={18} />
                <span>上載付款記錄</span>
              </div>
            </div>
            <div className="quote-payment-confirm">
              <button className="btn btn-primary" type="button">確認客戶付款</button>
            </div>
          </div>
          <div className="quote-handoff-card quote-submit-card">
            <h3>3. 交Office跟進</h3>
            <button className="btn btn-primary">提交Office</button>
          </div>
          <div className="quote-wizard-footer">
            <button className="btn" onClick={() => setStep(3)}>上一步</button>
          </div>
        </>
      )}
    </div>
  );
}
