"""
Admin tool: give someone CRM access (they can then sign in with Microsoft).
    python -m auth_service.seed_user add rahul@company.com "Rahul Sharma" "Sales Rep"
    python -m auth_service.seed_user list
    python -m auth_service.seed_user deactivate rahul@company.com
The email must be the person's Microsoft work sign-in name.
"""
import sys

from .database import SessionLocal
from .models import User, ROLES


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    db = SessionLocal()
    try:
        cmd = args[0]
        if cmd == "list":
            for u in db.query(User).order_by(User.id):
                print(f"{u.id:>3}  {u.email:<40} {u.role:<12} {'active' if u.is_active else 'INACTIVE'}")
        elif cmd == "add" and len(args) >= 3:
            email, name = args[1].strip().lower(), args[2]
            role = args[3] if len(args) > 3 else "Sales Rep"
            if role not in ROLES:
                print(f"Role must be one of: {', '.join(ROLES)}")
                sys.exit(1)
            if db.query(User).filter(User.email == email).first():
                print(f"Already exists: {email}")
                return
            db.add(User(email=email, full_name=name, role=role))
            db.commit()
            print(f"Added: {email} ({role})")
        elif cmd == "deactivate" and len(args) == 2:
            u = db.query(User).filter(User.email == args[1].strip().lower()).first()
            if not u:
                print("No such user")
                sys.exit(1)
            u.is_active = False
            db.commit()
            print(f"Deactivated: {u.email}")
        else:
            print(__doc__)
            sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
