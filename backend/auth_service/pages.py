"""HTML for the login and welcome pages, styled after the DataPhi website (black, green/teal gradient, pill nav).
Layout uses flexbox only (no CSS Grid)."""
from html import escape

from .config import settings

FONT_LINK = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700&display=swap" rel="stylesheet">'
)

# Placeholder logo. To use the official one, set LOGO_URL in .env to the image address.
LOGO_MARK = """<svg width="50" height="50" viewBox="0 0 52 52" aria-hidden="true">
<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1ED760"/><stop offset="1" stop-color="#00D9DD"/></linearGradient></defs>
<path d="M26 5 A21 21 0 1 0 47 26" fill="none" stroke="url(#lg)" stroke-width="4" stroke-linecap="round"/>
<path d="M19 15 H27 A11 11 0 0 1 27 37 H19 Z" fill="none" stroke="url(#lg)" stroke-width="4" stroke-linejoin="round"/>
<path d="M26 22 H29 A4 4 0 0 1 29 30 H26" fill="none" stroke="url(#lg)" stroke-width="3" stroke-linecap="round"/>
</svg>"""


def _spiral() -> str:
    """Concentric circles that drift toward a centre point, like the tunnel graphic on the website."""
    parts = []
    n = 22
    for i in range(n):
        r = 250 - i * 11
        cx = 270 + i * 2.6
        cy = 270 + i * 0.6
        opacity = 0.18 + 0.80 * (i / (n - 1))
        parts.append(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="none" stroke="url(#sg)" '
            f'stroke-width="1.5" opacity="{opacity:.2f}"/>'
        )
    return (
        '<svg class="spiral" viewBox="0 0 540 540" aria-hidden="true">'
        '<defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#12d6b0"/><stop offset="1" stop-color="#2a5cff"/></linearGradient></defs>'
        + "".join(parts)
        + "</svg>"
    )


CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:#000;color:#fff;font-family:'Urbanist','Segoe UI',Arial,sans-serif;min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden}
.glow{position:fixed;left:0;right:0;top:0;bottom:0;pointer-events:none;z-index:0;
 background:radial-gradient(ellipse 55% 30% at 28% 108%,rgba(30,215,96,.30),transparent 70%),
            radial-gradient(ellipse 40% 30% at 100% 104%,rgba(122,60,255,.32),transparent 70%)}
a{color:inherit}
.nav{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:20px;
 width:calc(100% - 40px);max-width:1780px;margin:20px auto 0;padding:14px 34px;background:#000;border:1px solid #1e1e1e;border-radius:64px}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.brand img{height:48px;display:block}
.wm{display:block;font-size:34px;font-weight:500;line-height:1;letter-spacing:.3px}
.tag{white-space:nowrap;display:block;font-size:11px;font-weight:400;color:#d4d4d4;margin-top:5px}
.navmid{font-size:19px;font-weight:500;padding:6px 0;border-bottom:2px solid #16d39a}
.btn-grad{display:inline-block;background:linear-gradient(90deg,#1ED760,#00E3D6);color:#06120c;font-weight:600;font-size:18px;
 text-decoration:none;padding:15px 34px;border-radius:40px;white-space:nowrap}
.btn-grad:hover{filter:brightness(1.08)}
.hero{position:relative;z-index:1;flex:1;display:flex;flex-wrap:wrap;align-items:flex-start;align-content:flex-start;justify-content:space-between;gap:48px;
 width:100%;max-width:1780px;margin:0 auto;padding:72px 64px 96px}
.left{position:relative;flex:1 1 460px;max-width:760px;min-height:640px}
.right{flex:1 1 420px;max-width:740px}
h1{font-size:clamp(34px,4.4vw,64px);font-weight:300;line-height:1.16;letter-spacing:-.5px}
h1 b{font-weight:700}
.spiral{position:absolute;left:-70px;top:270px;width:560px;height:560px;max-width:none}
.lead{font-size:20px;font-weight:400;margin-bottom:28px;line-height:1.4}
.field{display:block;width:100%;background:#0e0e0e;border:1px solid #1c1c1c;padding:20px 22px;font:inherit;font-size:18px;color:#e6e6e6;border-radius:0}
select.field{padding-right:52px;text-overflow:ellipsis;appearance:none;-webkit-appearance:none;background-image:linear-gradient(45deg,transparent 50%,#8a8a8a 50%),linear-gradient(135deg,#8a8a8a 50%,transparent 50%);
 background-position:calc(100% - 26px) 50%,calc(100% - 20px) 50%;background-size:6px 6px,6px 6px;background-repeat:no-repeat}
.field:focus{outline:2px solid #16d39a;outline-offset:2px}
.stack{display:flex;flex-direction:column;gap:20px}
.pill{display:inline-flex;align-items:center;justify-content:center;gap:14px;border:1px solid #13c67a;border-radius:40px;padding:17px 36px;
 font:inherit;font-size:18px;font-weight:500;color:#fff;background:transparent;cursor:pointer;text-decoration:none;transition:background .2s,color .2s}
.pill:hover,.pill:focus-visible{background:linear-gradient(90deg,#1ED760,#00E3D6);color:#06120c;outline:none}
.ms{display:inline-flex;flex-wrap:wrap;width:22px;gap:2px}
.ms i{display:block;width:10px;height:10px}
.note{font-size:16px;color:#a9a9a9;line-height:1.5;margin-top:26px}
.err{border:1px solid #7a2222;background:#1a0909;color:#ff9a9a;padding:15px 18px;margin-bottom:22px;font-size:17px;line-height:1.45}
.demo{border:1px dashed #b98a1e;background:#151000;color:#f1c766;padding:15px 18px;margin-bottom:22px;font-size:16px;line-height:1.45}
.rows{border:1px solid #1c1c1c;background:#0e0e0e;margin-bottom:26px}
.row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;padding:18px 22px;border-bottom:1px solid #1c1c1c;font-size:18px}
.row:last-child{border-bottom:none}
.row span:first-child{color:#9a9a9a}
.btns{display:flex;flex-wrap:wrap;gap:16px}
.foot{position:relative;z-index:1;text-align:center;color:#6f6f6f;font-size:14px;padding:0 20px 24px}
@media (max-width:900px){
 .hero{padding:44px 22px 70px;gap:36px}
 .left{min-height:0}
 .spiral{display:none}
 .nav{padding:12px 18px}
 .navmid{display:none}
 .wm{font-size:26px}
 .btn-grad{padding:12px 22px;font-size:16px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
"""


def _logo() -> str:
    url = settings().logo_url.strip()
    if url:
        return f'<img src="{escape(url, quote=True)}" alt="DataPhi">'
    return LOGO_MARK + '<span><span class="wm">DataPhi</span><span class="tag">Conversation to Conversion</span></span>'


def _page(title: str, left: str, right: str, nav_btn: str) -> str:
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{escape(title)}</title>{FONT_LINK}<style>{CSS}</style></head><body>"
        '<div class="glow"></div>'
        f'<header class="nav"><a class="brand" href="/login">{_logo()}</a>'
        f'<span class="navmid">CRM Portal</span>{nav_btn}</header>'
        f'<main class="hero"><section class="left">{left}{_spiral()}</section>'
        f'<section class="right" id="signin">{right}</section></main>'
        '<footer class="foot">DataPhi internal CRM. Authorised users only.</footer>'
        "</body></html>"
    )


MS_LOGO = '<span class="ms"><i style="background:#F25022"></i><i style="background:#7FBA00"></i><i style="background:#00A4EF"></i><i style="background:#FFB900"></i></span>'


def login_page(error: str | None = None, demo_users: list | None = None) -> str:
    """demo_users: list of (email, name, role) when running in demo mode, otherwise None."""
    banner = f'<div class="err" role="alert">{escape(error)}</div>' if error else ""

    if demo_users is not None:
        options = "".join(
            f'<option value="{escape(e, quote=True)}">{escape(n or e)} - {escape(r)} ({escape(e)})</option>'
            for e, n, r in demo_users
        )
        body = (
            '<div class="demo"><b>Demo mode.</b> No Microsoft account needed. Pick a test user to continue. '
            "Set AUTH_MODE=microsoft in .env for the real Microsoft login.</div>"
            '<form method="post" action="/auth/demo/login" class="stack">'
            f'<select class="field" name="email" aria-label="Demo user">{options}</select>'
            '<div><button class="pill" type="submit">Continue as demo user</button></div></form>'
        )
    else:
        body = (
            '<div><a class="pill" href="/auth/login">' + MS_LOGO + "Sign in with Microsoft</a></div>"
            '<p class="note">Use your DataPhi work account. Only people added to the CRM by an Admin can get in. '
            "If you see \"no CRM account\", ask your Admin to add your work email.</p>"
        )

    left = "<h1>Your Sales Pipeline, <b>One Secure Login</b> Away</h1>"
    right = f'<p class="lead">Sign in to continue to the DataPhi CRM.</p>{banner}{body}'
    return _page("Sign in - DataPhi CRM", left, right, '<a class="btn-grad" href="#signin">Sign in</a>')


def welcome_page(user: dict, mode: str) -> str:
    name = escape(user.get("name") or user["email"])
    left = f"<h1>Welcome, <b>{name}</b></h1>"
    right = (
        '<p class="lead">You are signed in. This is the test landing page for the SSO module.</p>'
        '<div class="rows">'
        f'<div class="row"><span>Email</span><span>{escape(user["email"])}</span></div>'
        f'<div class="row"><span>Role</span><span>{escape(user["role"])}</span></div>'
        f'<div class="row"><span>Login mode</span><span>{escape(mode)}</span></div>'
        "</div>"
        '<div class="btns"><a class="pill" href="/auth/me">View session details</a>'
        '<a class="pill" href="/auth/logout">Sign out</a></div>'
        '<p class="note">In the real CRM, set APP_LANDING_URL in .env to the CRM home page so people land there after login.</p>'
    )
    return _page("Signed in - DataPhi CRM", left, right, '<a class="btn-grad" href="/auth/logout">Sign out</a>')
