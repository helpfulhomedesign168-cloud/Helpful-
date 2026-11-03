import React, { useState } from "react";
import { Check, Plus, UserCog } from "lucide-react";
import { useApp } from "../context";
import {
  Badge,
  Button,
  Dialog,
  Empty,
  Field,
  PageHead,
} from "../components/ui";
import {
  Actor,
  ROLE_NAMES,
  Role,
  Team,
} from "../domain/types";

type UserDraft = {
  id?: string;
  name: string;
  code: string;
  role: Role;
  team?: Team;
};

const EMPTY_USER: UserDraft = {
  name: "",
  code: "",
  role: "sales",
  team: "B",
};

export function Users() {
  const { actor, engine, run } = useApp();
  const users = engine.listUsers(actor);
  const [editing, setEditing] = useState<UserDraft | null>(null);
  const openNew = () => setEditing({ ...EMPTY_USER });
  const openEdit = (user: Actor) =>
    setEditing({
      id: user.id,
      name: user.name,
      code: user.code,
      role: user.role,
      team: user.team,
    });
  return (
    <>
      <PageHead
        title="用戶管理"
        actions={
          <Button variant="primary" onClick={openNew}>
            <Plus size={20} /> 新增用戶
          </Button>
        }
      />
      <div className="list-panel">
        {users.length === 0 ? (
          <Empty title="暫無用戶" />
        ) : (
          <div className="table-scroll">
            <table className="user-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>Code</th>
                  <th>角色</th>
                  <th>Team</th>
                  <th>狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={user.active === false ? "user-inactive" : ""}
                  >
                    <td>
                      <strong>{user.name}</strong>
                      {user.id === actor.id && <small>目前登入</small>}
                    </td>
                    <td>
                      <code>{user.code}</code>
                    </td>
                    <td>{ROLE_NAMES[user.role]}</td>
                    <td>{user.team ? `Team ${user.team}` : "—"}</td>
                    <td>
                      <Badge strong={user.active !== false}>
                        {user.active === false ? "已停用" : "啟用中"}
                      </Badge>
                    </td>
                    <td>
                      <div className="user-row-actions">
                        <Button
                          variant="ghost"
                          aria-label={`修改${user.name}`}
                          onClick={() => openEdit(user)}
                        >
                          修改
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`${user.active === false ? "啟用" : "停用"}${user.name}`}
                          onClick={() =>
                            run(
                              () =>
                                engine.setUserActive(
                                  actor,
                                  user.id,
                                  user.active === false,
                                ),
                              user.active === false
                                ? "用戶已啟用。"
                                : "用戶已停用。",
                            )
                          }
                        >
                          {user.active === false ? "啟用" : "停用"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <Dialog
          title={editing.id ? "修改用戶" : "新增用戶"}
          onClose={() => setEditing(null)}
        >
          <div className="user-editor-intro">
            <UserCog size={22} />
            <p>
              Code 建立後不可更改，會用於報價、Invoice及業績編號。停用用戶會保留歷史單據。
            </p>
          </div>
          <div className="form-grid two">
            <Field label="姓名" required>
              <input
                aria-label="用戶姓名"
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </Field>
            <Field label="員工Code" required>
              <input
                aria-label="員工Code"
                value={editing.code}
                disabled={Boolean(editing.id)}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    code: event.target.value.toUpperCase(),
                  })
                }
                placeholder="例如：MM"
              />
            </Field>
            <Field label="角色" required>
              <select
                aria-label="用戶角色"
                value={editing.role}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    role: event.target.value as Role,
                  })
                }
              >
                {(Object.keys(ROLE_NAMES) as Role[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_NAMES[role]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Team">
              <select
                aria-label="用戶Team"
                value={editing.team ?? ""}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    team: event.target.value
                      ? (event.target.value as Team)
                      : undefined,
                  })
                }
              >
                <option value="">—</option>
                <option value="A">Team A</option>
                <option value="B">Team B</option>
              </select>
            </Field>
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const saved = run(
                  () => engine.saveUser(actor, editing),
                  editing.id ? "用戶已更新。" : "用戶已新增。",
                );
                if (saved) setEditing(null);
              }}
            >
              <Check size={18} /> {editing.id ? "儲存修改" : "新增用戶"}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
