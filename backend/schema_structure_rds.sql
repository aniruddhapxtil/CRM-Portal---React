--
-- PostgreSQL database dump
--

\restrict tbB1gH2eX7X2Ftb53mojuXbv5R3KSmOmcG8jhe0Fful52CyzesgzOORIv9jeRCO

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id integer NOT NULL,
    account_name character varying(255) NOT NULL,
    account_manager character varying(150),
    region character varying(100),
    industry character varying(100),
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    last_update_date timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    updated_by integer,
    website character varying(500),
    notes text,
    attribute_1 character varying(255),
    attribute_2 character varying(255),
    attribute_3 character varying(255),
    attribute_4 character varying(255),
    attribute_5 character varying(255),
    attribute_6 character varying(255),
    attribute_7 character varying(255),
    attribute_8 character varying(255),
    attribute_9 character varying(255),
    attribute_10 character varying(255)
);


--
-- Name: account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_id_seq OWNED BY public.account.id;


--
-- Name: activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity (
    id integer NOT NULL,
    activity_name character varying(255) NOT NULL,
    account_id integer,
    subsidiary_id integer,
    contact_id integer,
    lead_id integer,
    opportunity_id integer,
    project_id integer,
    record_type character varying(50),
    record_action character varying(50),
    account_name character varying(255),
    contact_name character varying(255),
    subsidiary_name character varying(255),
    activity_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    next_step character varying(255),
    next_action_date date,
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    attribute_1 character varying(255),
    attribute_2 character varying(255),
    attribute_3 character varying(255),
    attribute_4 character varying(255),
    attribute_5 character varying(255),
    attribute_6 character varying(255),
    attribute_7 character varying(255),
    attribute_8 character varying(255),
    attribute_9 character varying(255),
    attribute_10 character varying(255)
);


--
-- Name: activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_id_seq OWNED BY public.activity.id;


--
-- Name: contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact (
    id integer NOT NULL,
    account_id integer NOT NULL,
    subsidiary_id integer,
    contact_name character varying(255) NOT NULL,
    designation character varying(150),
    email character varying(320),
    mobile character varying(50),
    secondary_mobile character varying(50),
    linkedin_url character varying(500),
    notes text,
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    last_update_date timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    updated_by integer,
    department character varying(150),
    mobile_country_code character varying(6) DEFAULT '+971'::character varying,
    secondary_mobile_country_code character varying(6) DEFAULT '+971'::character varying,
    secondary_email character varying(320),
    attribute_1 character varying(255),
    attribute_2 character varying(255),
    attribute_3 character varying(255),
    attribute_4 character varying(255),
    attribute_5 character varying(255),
    attribute_6 character varying(255),
    attribute_7 character varying(255),
    attribute_8 character varying(255),
    attribute_9 character varying(255),
    attribute_10 character varying(255)
);


--
-- Name: contact_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contact_id_seq OWNED BY public.contact.id;


--
-- Name: lead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead (
    id integer NOT NULL,
    lead_name character varying(255) NOT NULL,
    account_id integer NOT NULL,
    subsidiary_id integer,
    contact_id integer,
    account_manager character varying(150),
    deal_size numeric(15,2),
    currency character varying(10),
    type character varying(50),
    stage character varying(50),
    disqualification_reason character varying(255),
    lead_source character varying(150),
    next_steps character varying(255),
    next_action_date date,
    closure_date date,
    notes text,
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    last_update_date timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    updated_by integer,
    project_type character varying(50),
    referred_by character varying(150),
    technology character varying(150)[],
    campaign_name character varying(255),
    attribute_1 character varying(255),
    attribute_2 character varying(255),
    attribute_3 character varying(255),
    attribute_4 character varying(255),
    attribute_5 character varying(255),
    attribute_6 character varying(255),
    attribute_7 character varying(255),
    attribute_8 character varying(255),
    attribute_9 character varying(255),
    attribute_10 character varying(255),
    service_line character varying(255)
);


--
-- Name: lead_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lead_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lead_id_seq OWNED BY public.lead.id;


--
-- Name: opportunity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunity (
    id integer NOT NULL,
    opportunity_name character varying(255) NOT NULL,
    lead_id integer,
    account_id integer NOT NULL,
    subsidiary_id integer,
    contact_id integer,
    account_manager character varying(150),
    deal_size numeric(15,2),
    currency character varying(10),
    project_type character varying(50),
    stage character varying(50) NOT NULL,
    probability integer,
    reason character varying(255),
    opportunity_type character varying(100),
    funded_by character varying(100),
    opportunity_source character varying(150),
    next_steps character varying(255),
    next_action_date date,
    closure_date date,
    notes text,
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    last_update_date timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    updated_by integer,
    referred_by character varying(150),
    technology character varying(150)[],
    attribute_1 character varying(255),
    attribute_2 character varying(255),
    attribute_3 character varying(255),
    attribute_4 character varying(255),
    attribute_5 character varying(255),
    attribute_6 character varying(255),
    attribute_7 character varying(255),
    attribute_8 character varying(255),
    attribute_9 character varying(255),
    attribute_10 character varying(255),
    expected_closure_date date,
    service_line character varying(255)
);


--
-- Name: opportunity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.opportunity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: opportunity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.opportunity_id_seq OWNED BY public.opportunity.id;


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    id integer NOT NULL,
    opportunity_id integer NOT NULL,
    account_id integer NOT NULL,
    subsidiary_id integer,
    contact_id integer,
    project_name character varying(255) NOT NULL,
    stage character varying(50) NOT NULL,
    po_number character varying(150),
    po_reason character varying(255),
    value numeric(15,2),
    currency character varying(10),
    start_date date,
    close_date date,
    notes text,
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    last_update_date timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    updated_by integer,
    technology character varying(150)[],
    attribute_1 character varying(255),
    attribute_2 character varying(255),
    attribute_3 character varying(255),
    attribute_4 character varying(255),
    attribute_5 character varying(255),
    attribute_6 character varying(255),
    attribute_7 character varying(255),
    attribute_8 character varying(255),
    attribute_9 character varying(255),
    attribute_10 character varying(255),
    po_document_s3_key character varying(500),
    po_document_name character varying(255),
    po_uploaded_at timestamp with time zone
);


--
-- Name: project_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_id_seq OWNED BY public.project.id;


--
-- Name: role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role (
    id integer NOT NULL,
    role_name character varying(100) NOT NULL,
    description character varying(255),
    creation_date timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_id_seq OWNED BY public.role.id;


--
-- Name: subsidiary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subsidiary (
    id integer NOT NULL,
    account_id integer NOT NULL,
    subsidiary_name character varying(255) NOT NULL,
    industry character varying(100),
    region character varying(100),
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    last_update_date timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    updated_by integer,
    notes text,
    attribute_1 character varying(255),
    attribute_2 character varying(255),
    attribute_3 character varying(255),
    attribute_4 character varying(255),
    attribute_5 character varying(255),
    attribute_6 character varying(255),
    attribute_7 character varying(255),
    attribute_8 character varying(255),
    attribute_9 character varying(255),
    attribute_10 character varying(255)
);


--
-- Name: subsidiary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subsidiary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subsidiary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subsidiary_id_seq OWNED BY public.subsidiary.id;


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id integer NOT NULL,
    user_name character varying(150) NOT NULL,
    email_id character varying(320) NOT NULL,
    designation character varying(150),
    region character varying(100),
    phone character varying(50),
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    role character varying(50) DEFAULT 'Sales Rep'::character varying NOT NULL,
    ms_oid character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp without time zone
);


--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_id_seq OWNED BY public."user".id;


--
-- Name: voice_draft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_draft (
    id integer NOT NULL,
    user_id integer,
    user_email character varying(320),
    user_phone character varying(50),
    raw_transcript text NOT NULL,
    target_entity character varying(50) NOT NULL,
    extracted_json text NOT NULL,
    missing_fields character varying[] NOT NULL,
    clarification_prompt text,
    status character varying(50) NOT NULL,
    creation_date timestamp with time zone DEFAULT now() NOT NULL,
    last_update_date timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: voice_draft_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voice_draft_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voice_draft_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voice_draft_id_seq OWNED BY public.voice_draft.id;


--
-- Name: voice_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_interactions (
    id integer NOT NULL,
    transcript text NOT NULL,
    intent character varying(100),
    extracted_json text NOT NULL,
    processing_ms integer,
    status character varying(50) NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: voice_interactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voice_interactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voice_interactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voice_interactions_id_seq OWNED BY public.voice_interactions.id;


--
-- Name: account id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account ALTER COLUMN id SET DEFAULT nextval('public.account_id_seq'::regclass);


--
-- Name: activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity ALTER COLUMN id SET DEFAULT nextval('public.activity_id_seq'::regclass);


--
-- Name: contact id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact ALTER COLUMN id SET DEFAULT nextval('public.contact_id_seq'::regclass);


--
-- Name: lead id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead ALTER COLUMN id SET DEFAULT nextval('public.lead_id_seq'::regclass);


--
-- Name: opportunity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity ALTER COLUMN id SET DEFAULT nextval('public.opportunity_id_seq'::regclass);


--
-- Name: project id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project ALTER COLUMN id SET DEFAULT nextval('public.project_id_seq'::regclass);


--
-- Name: role id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role ALTER COLUMN id SET DEFAULT nextval('public.role_id_seq'::regclass);


--
-- Name: subsidiary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subsidiary ALTER COLUMN id SET DEFAULT nextval('public.subsidiary_id_seq'::regclass);


--
-- Name: user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user" ALTER COLUMN id SET DEFAULT nextval('public.user_id_seq'::regclass);


--
-- Name: voice_draft id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_draft ALTER COLUMN id SET DEFAULT nextval('public.voice_draft_id_seq'::regclass);


--
-- Name: voice_interactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_interactions ALTER COLUMN id SET DEFAULT nextval('public.voice_interactions_id_seq'::regclass);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: activity activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_pkey PRIMARY KEY (id);


--
-- Name: contact contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_pkey PRIMARY KEY (id);


--
-- Name: lead lead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_pkey PRIMARY KEY (id);


--
-- Name: opportunity opportunity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_pkey PRIMARY KEY (id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: role role_role_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_role_name_key UNIQUE (role_name);


--
-- Name: subsidiary subsidiary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subsidiary
    ADD CONSTRAINT subsidiary_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: voice_draft voice_draft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_draft
    ADD CONSTRAINT voice_draft_pkey PRIMARY KEY (id);


--
-- Name: voice_interactions voice_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_interactions
    ADD CONSTRAINT voice_interactions_pkey PRIMARY KEY (id);


--
-- Name: ix_account_account_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_account_account_name ON public.account USING btree (account_name);


--
-- Name: ix_contact_contact_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contact_contact_name ON public.contact USING btree (contact_name);


--
-- Name: ix_user_email_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_user_email_id ON public."user" USING btree (email_id);


--
-- Name: account account_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id);


--
-- Name: account account_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public."user"(id);


--
-- Name: activity activity_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: activity activity_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contact(id);


--
-- Name: activity activity_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id);


--
-- Name: activity activity_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.lead(id);


--
-- Name: activity activity_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id);


--
-- Name: activity activity_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id);


--
-- Name: activity activity_subsidiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_subsidiary_id_fkey FOREIGN KEY (subsidiary_id) REFERENCES public.subsidiary(id);


--
-- Name: contact contact_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: contact contact_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id);


--
-- Name: contact contact_subsidiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_subsidiary_id_fkey FOREIGN KEY (subsidiary_id) REFERENCES public.subsidiary(id);


--
-- Name: contact contact_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public."user"(id);


--
-- Name: lead lead_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: lead lead_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contact(id);


--
-- Name: lead lead_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id);


--
-- Name: lead lead_subsidiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_subsidiary_id_fkey FOREIGN KEY (subsidiary_id) REFERENCES public.subsidiary(id);


--
-- Name: lead lead_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead
    ADD CONSTRAINT lead_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public."user"(id);


--
-- Name: opportunity opportunity_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: opportunity opportunity_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contact(id);


--
-- Name: opportunity opportunity_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id);


--
-- Name: opportunity opportunity_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.lead(id);


--
-- Name: opportunity opportunity_subsidiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_subsidiary_id_fkey FOREIGN KEY (subsidiary_id) REFERENCES public.subsidiary(id);


--
-- Name: opportunity opportunity_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity
    ADD CONSTRAINT opportunity_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public."user"(id);


--
-- Name: project project_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: project project_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contact(id);


--
-- Name: project project_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id);


--
-- Name: project project_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunity(id);


--
-- Name: project project_subsidiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_subsidiary_id_fkey FOREIGN KEY (subsidiary_id) REFERENCES public.subsidiary(id);


--
-- Name: project project_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public."user"(id);


--
-- Name: subsidiary subsidiary_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subsidiary
    ADD CONSTRAINT subsidiary_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: subsidiary subsidiary_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subsidiary
    ADD CONSTRAINT subsidiary_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id);


--
-- Name: subsidiary subsidiary_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subsidiary
    ADD CONSTRAINT subsidiary_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public."user"(id);


--
-- Name: voice_draft voice_draft_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_draft
    ADD CONSTRAINT voice_draft_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- PostgreSQL database dump complete
--

\unrestrict tbB1gH2eX7X2Ftb53mojuXbv5R3KSmOmcG8jhe0Fful52CyzesgzOORIv9jeRCO

