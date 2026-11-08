import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { createCompany, updateCompany, setCompanyActive, listCompaniesForActor, getCompany } from "@/server/services/companies";
import { createUser, addMember, updateMemberRole, login } from "@/server/services/users";
import { validateSessionToken, deleteSessionToken } from "@/server/auth/session";
import { makeUser, makeCompany, addRole, uniqTax } from "../helpers";
import type { Actor } from "@/server/auth/session";

let admin: Actor;
beforeAll(async () => {
  admin = await makeUser({ sysadmin: true });
});

describe("Quản lý công ty", () => {
  it("System Admin tạo công ty với MST, tên, địa chỉ, năm tài chính", async () => {
    const tax = uniqTax();
    const c = await createCompany(admin, { taxCode: ` ${tax} `, name: "Công ty TNHH FDI Alpha", address: "KCN Alpha", fiscalYearStartMonth: 4, currentFiscalYear: 2026, investorCountry: "Nhật Bản" });
    expect(c.taxCode).toBe(tax);
    expect(c.fiscalYearStartMonth).toBe(4);
    const again = await prisma.company.findUnique({ where: { id: c.id } });
    expect(again?.name).toBe("Công ty TNHH FDI Alpha");
  });

  it("từ chối MST không hợp lệ và MST trùng", async () => {
    await expect(createCompany(admin, { taxCode: "123", name: "X Co", address: "abc", currentFiscalYear: 2026 })).rejects.toThrow(/MST không hợp lệ/);
    const tax = uniqTax();
    await createCompany(admin, { taxCode: tax, name: "Một", address: "abc", currentFiscalYear: 2026 });
    await expect(createCompany(admin, { taxCode: tax, name: "Hai", address: "abc", currentFiscalYear: 2026 })).rejects.toThrow(/đã tồn tại/);
  });

  it("sửa công ty và ngừng hoạt động / kích hoạt lại", async () => {
    const c = await makeCompany();
    const u = await updateCompany(admin, c.id, { name: "Tên mới", address: "Địa chỉ mới" });
    expect(u.name).toBe("Tên mới");
    const off = await setCompanyActive(admin, c.id, false);
    expect(off.isActive).toBe(false);
    const on = await setCompanyActive(admin, c.id, true);
    expect(on.isActive).toBe(true);
  });

  it("Company Admin không thể đổi MST; chỉ System Admin tạo công ty", async () => {
    const c = await makeCompany();
    const ca = await makeUser();
    await addRole(ca.id, c.id, "COMPANY_ADMIN");
    await expect(updateCompany(ca, c.id, { taxCode: uniqTax() })).rejects.toThrow(/quyền/);
    await expect(createCompany(ca, { taxCode: uniqTax(), name: "Abc", address: "abc", currentFiscalYear: 2026 })).rejects.toThrow(/quyền/);
    const ok = await updateCompany(ca, c.id, { address: "Đã đổi bởi CA" });
    expect(ok.address).toBe("Đã đổi bởi CA");
  });
});

describe("Phân quyền người dùng", () => {
  it("Editor không sửa được công ty, Viewer không có quyền quản trị thành viên", async () => {
    const c = await makeCompany();
    const editor = await makeUser();
    const viewer = await makeUser();
    await addRole(editor.id, c.id, "EDITOR");
    await addRole(viewer.id, c.id, "VIEWER");
    await expect(updateCompany(editor, c.id, { name: "Hack" })).rejects.toMatchObject({ status: 403 });
    await expect(addMember(viewer, c.id, editor.email, "COMPANY_ADMIN")).rejects.toMatchObject({ status: 403 });
    expect((await getCompany(viewer, c.id)).myRole).toBe("VIEWER");
  });

  it("Company Admin tạo tài khoản mới gắn vào công ty và đổi vai trò", async () => {
    const c = await makeCompany();
    const ca = await makeUser();
    await addRole(ca.id, c.id, "COMPANY_ADMIN");
    const nu = await createUser(ca, { email: `ketoan${Date.now()}@test.local`, name: "Kế toán viên", password: "KeToan2026" }, { companyId: c.id, role: "VIEWER" });
    const m = await prisma.membership.findFirstOrThrow({ where: { userId: nu.id, companyId: c.id } });
    expect(m.role).toBe("VIEWER");
    await updateMemberRole(ca, c.id, m.id, "EDITOR");
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: m.id } })).role).toBe("EDITOR");
  });

  it("Company Admin không thể tạo System Admin", async () => {
    const c = await makeCompany();
    const ca = await makeUser();
    await addRole(ca.id, c.id, "COMPANY_ADMIN");
    await expect(createUser(ca, { email: `x${Date.now()}@test.local`, name: "Kẻ xấu", password: "Abc12345", isSystemAdmin: true }, { companyId: c.id, role: "VIEWER" })).rejects.toMatchObject({ status: 403 });
  });

  it("danh sách công ty chỉ gồm công ty được phân quyền", async () => {
    const c1 = await makeCompany();
    await makeCompany();
    const u = await makeUser();
    await addRole(u.id, c1.id, "VIEWER");
    const list = await listCompaniesForActor(u);
    expect(list.map((x) => x.id)).toEqual([c1.id]);
  });
});

describe("Đăng nhập & phiên", () => {
  it("đăng nhập đúng tạo phiên lưu trong DB; sai mật khẩu bị từ chối; đăng xuất xóa phiên", async () => {
    const email = `login${Date.now()}@test.local`;
    await makeUser({ email, password: "MatKhau123" });
    await expect(login(email, "sai-mat-khau")).rejects.toThrow(/không đúng/);
    const { session } = await login(email.toUpperCase(), "MatKhau123");
    const actor = await validateSessionToken(session.token);
    expect(actor?.email).toBe(email);
    await deleteSessionToken(session.token);
    expect(await validateSessionToken(session.token)).toBeNull();
  });

  it("tài khoản bị khóa không đăng nhập được", async () => {
    const email = `locked${Date.now()}@test.local`;
    const u = await makeUser({ email, password: "MatKhau123" });
    await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
    await expect(login(email, "MatKhau123")).rejects.toMatchObject({ status: 403 });
  });
});
