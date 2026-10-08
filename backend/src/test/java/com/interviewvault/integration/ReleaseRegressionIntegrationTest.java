package com.interviewvault.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.interviewvault.auth.entity.User;
import com.interviewvault.auth.enums.UserRole;
import com.interviewvault.auth.repository.UserMapper;
import com.interviewvault.catalog.entity.*;
import com.interviewvault.catalog.repository.*;
import com.interviewvault.interview.dto.request.*;
import com.interviewvault.interview.enums.*;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = false)
class ReleaseRegressionIntegrationTest {
 @Container @ServiceConnection static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:18");
 @Autowired MockMvc mvc;
 @Autowired ObjectMapper json;
 @Autowired UserMapper users;
 @Autowired CompanyMapper companies;
 @Autowired PositionMapper positions;
 @Autowired JdbcTemplate jdbc;
 record Sample(long user, long interview, ObjectNode body, JsonNode saved) {}
 RequestPostProcessor user(long id) { return oauth2Login().attributes(a -> a.put("userId", id)).authorities(new SimpleGrantedAuthority("ROLE_USER")); }
 RequestPostProcessor admin(long id) { return oauth2Login().attributes(a -> a.put("userId", id)).authorities(new SimpleGrantedAuthority("ROLE_ADMIN")); }
 Sample seed(boolean follow, boolean secondRound) throws Exception {
  User u = new User(System.nanoTime(), "audit-synthetic", null, UserRole.USER); users.insert(u);
  String unique="audit-"+System.nanoTime(); Company c=new Company(unique,unique); companies.insert(c);
  long cat=jdbc.queryForObject("select min(id) from position_category",Long.class);
  Position p=new Position(unique,unique,cat); positions.insert(p);
  var created=mvc.perform(post("/api/v1/me/interviews").with(user(u.getId())).with(csrf())).andReturn().getResponse();
  assertThat(created.getStatus()).isEqualTo(201);
  long id=json.readTree(created.getContentAsString()).path("data").path("id").asLong();
  ObjectNode b=json.createObjectNode(); b.put("version",0);
  b.putObject("company").put("existingId",c.getId()); b.putObject("position").put("existingId",p.getId()); b.put("recruitType","CAMPUS");
  ArrayNode rs=b.putArray("rounds"); ObjectNode r=rs.addObject().put("roundType","TECHNICAL").put("roundNo",1);
  ObjectNode q=r.putArray("questions").addObject().put("content","old-question");
  if(follow) q.putArray("followUps").addObject().put("content","old-follow");
  if(secondRound) rs.addObject().put("roundType","TECHNICAL").put("roundNo",2).putArray("questions").addObject().put("content","second-question");
  var response=mvc.perform(put("/api/v1/me/interviews/"+id).with(user(u.getId())).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(b.toString())).andReturn().getResponse();
  assertThat(response.getStatus()).isEqualTo(200);
  JsonNode saved=json.readTree(response.getContentAsString()).path("data").path("interview");
  b.put("version",1); b.set("rounds",saved.path("rounds").deepCopy());
  return new Sample(u.getId(),id,b,saved);
 }
 int save(Sample s,ObjectNode body) throws Exception { return mvc.perform(put("/api/v1/me/interviews/"+s.interview).with(user(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body.toString())).andReturn().getResponse().getStatus(); }
 @Test void inserting_new_question_before_existing_should_save() throws Exception {
  Sample s=seed(false,false); ArrayNode qs=(ArrayNode)s.body.path("rounds").get(0).path("questions");
  ObjectNode added=json.createObjectNode().put("content","new-first-question"); qs.insert(0,added);
  int status=save(s,s.body); System.out.println("AUDIT new_question_before_existing HTTP="+status);
  assertThat(status).isEqualTo(200);
 }
 @Test void inserting_new_followup_before_existing_should_save() throws Exception {
  Sample s=seed(true,false); ArrayNode fs=(ArrayNode)s.body.path("rounds").get(0).path("questions").get(0).path("followUps"); fs.insert(0,json.createObjectNode().put("content","new-first-follow"));
  int status=save(s,s.body); System.out.println("AUDIT new_followup_before_existing HTTP="+status); assertThat(status).isEqualTo(200);
 }
 @Test void moving_question_then_removing_original_round_should_preserve_question() throws Exception {
  Sample s=seed(false,true); ArrayNode rs=(ArrayNode)s.body.path("rounds"); JsonNode moved=rs.get(0).path("questions").get(0); long qid=moved.path("id").asLong();
  ((ArrayNode)rs.get(1).path("questions")).add(moved); rs.remove(0);
  int status=save(s,s.body); int retained=jdbc.queryForObject("select count(*) from question where id=?",Integer.class,qid);
  System.out.println("AUDIT move_and_remove_round HTTP="+status+" retained_question="+retained); assertThat(status).isEqualTo(200); assertThat(retained).isEqualTo(1);
 }
 void publish(Sample s) throws Exception {
  var submit=mvc.perform(post("/api/v1/me/interviews/"+s.interview+"/submit").with(user(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andReturn().getResponse(); assertThat(submit.getStatus()).isEqualTo(200);
  var published=mvc.perform(post("/api/v1/admin/reviews/interviews/"+s.interview+"/publish").with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}")).andReturn().getResponse(); assertThat(published.getStatus()).isEqualTo(200);
 }
 long upsert(Sample s,String text) throws Exception {
  ObjectNode payload=s.body.deepCopy(); payload.remove("version"); ((ObjectNode)payload.path("rounds").get(0).path("questions").get(0)).put("content",text);
  ObjectNode request=json.createObjectNode().put("type","UPDATE").put("baseVersion",3); request.set("payload",payload);
  var result=mvc.perform(put("/api/v1/me/interviews/"+s.interview+"/change-request").with(user(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(request.toString())).andReturn().getResponse(); assertThat(result.getStatus()).isEqualTo(200);
  return json.readTree(result.getContentAsString()).path("data").path("id").asLong();
 }
 @Test void replacing_application_after_admin_read_should_require_rereview() throws Exception {
  Sample s=seed(false,false); publish(s); long cr=upsert(s,"reviewed-content-A");
  var read=mvc.perform(get("/api/v1/admin/change-requests/"+cr).with(admin(s.user))).andReturn().getResponse(); assertThat(read.getStatus()).isEqualTo(200); assertThat(read.getContentAsString()).contains("reviewed-content-A");
  ObjectNode deletion=json.createObjectNode().put("type","DELETE").put("baseVersion",3).put("reason","changed-after-review"); assertThat(mvc.perform(put("/api/v1/me/interviews/"+s.interview+"/change-request").with(user(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(deletion.toString())).andReturn().getResponse().getStatus()).isEqualTo(200);
  var decision=mvc.perform(post("/api/v1/admin/change-requests/"+cr+"/approve").with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRequestVersion\":0}")).andReturn().getResponse();
  String publicContent=mvc.perform(get("/api/v1/interviews/"+s.interview)).andReturn().getResponse().getContentAsString();
  System.out.println("AUDIT stale_application_approve HTTP="+decision.getStatus()+" removed_after_reviewing_UPDATE="+publicContent.contains("INTERVIEW_REMOVED")); assertThat(decision.getStatus()).isEqualTo(409);
 }
 @Test void concurrent_publish_should_have_one_winner() throws Exception {
  Sample s=seed(false,false);
  assertThat(mvc.perform(post("/api/v1/me/interviews/"+s.interview+"/submit").with(user(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andReturn().getResponse().getStatus()).isEqualTo(200);
  ExecutorService pool=Executors.newFixedThreadPool(2); CountDownLatch start=new CountDownLatch(1);
  Callable<Integer> action=()->{start.await();return mvc.perform(post("/api/v1/admin/reviews/interviews/"+s.interview+"/publish").with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}")).andReturn().getResponse().getStatus();};
  try { Future<Integer>a=pool.submit(action),b=pool.submit(action); start.countDown(); List<Integer> result=List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS)); System.out.println("AUDIT concurrent_publish="+result); assertThat(result).containsExactlyInAnyOrder(200,409); } finally {pool.shutdownNow();}
 }
 @Test void null_round_element_should_return_validation_error() throws Exception {
  Sample s=seed(false,false); s.body.putArray("rounds").addNull(); int status=save(s,s.body); System.out.println("AUDIT null_round HTTP="+status); assertThat(status).isEqualTo(400);
 }
 @Test void historical_unknown_round_can_save_without_changing_it() throws Exception {
  Sample s=seed(false,false); long rid=s.saved.path("rounds").get(0).path("id").asLong(); jdbc.update("update interview_round set round_type='UNKNOWN',round_no=null,remark='legacy-remark' where id=?",rid);
  ObjectNode round=(ObjectNode)s.body.path("rounds").get(0); round.put("roundType","UNKNOWN"); round.putNull("roundNo"); int status=save(s,s.body); System.out.println("AUDIT legacy_unknown_unchanged HTTP="+status); assertThat(status).isEqualTo(200);
 }

 @Test void pending_update_can_be_overwritten_with_valid_update() throws Exception {
  Sample s=seed(false,false);publish(s);long cr=upsert(s,"first-proposal");assertThat(upsert(s,"second-proposal")).isEqualTo(cr);
 }
 @Test void logged_in_cheer_repeated_request_is_idempotent() throws Exception {
  Sample s=seed(false,false);
  int first=mvc.perform(post("/api/v1/cheers").with(user(s.user)).with(csrf())).andReturn().getResponse().getStatus();
  int repeated=mvc.perform(post("/api/v1/cheers").with(user(s.user)).with(csrf())).andReturn().getResponse().getStatus();
  System.out.println("AUDIT logged_cheer first="+first+" repeated="+repeated);assertThat(first).isEqualTo(200);assertThat(repeated).isEqualTo(200);
 }
 @Test void arbitrary_forwarded_prefix_should_not_bypass_rate_limit() throws Exception {
  String real="198.51.100.71";String fake="203.0.113.71";
  for(int n=0;n<5;n++) assertThat(mvc.perform(post("/api/v1/cheers").with(csrf()).header("X-Forwarded-For",real)).andReturn().getResponse().getStatus()).isEqualTo(200);
  int limited=mvc.perform(post("/api/v1/cheers").with(csrf()).header("X-Forwarded-For",real)).andReturn().getResponse().getStatus();
  int spoofed=mvc.perform(post("/api/v1/cheers").with(csrf()).header("X-Forwarded-For",fake+", "+real)).andReturn().getResponse().getStatus();
  System.out.println("AUDIT rate_limit same_IP="+limited+" untrusted_prefix="+spoofed);assertThat(limited).isEqualTo(429);assertThat(spoofed).isEqualTo(429);
 }
 @Test void approved_update_keeps_prior_published_revision() throws Exception {
  Sample s=seed(false,false);publish(s);
  long rid=s.saved.path("rounds").get(0).path("id").asLong();
  long qid=s.saved.path("rounds").get(0).path("questions").get(0).path("id").asLong();
  jdbc.update("update interview_round set remark='historical-round',interview_date='2026-01-01',interview_date_precision='YEAR' where id=?",rid);
  jdbc.update("update question set algorithm_title='original-algorithm',algorithm_description='original-description' where id=?",qid);
  long cr=upsert(s,"new-proposal");
  int approved=mvc.perform(post("/api/v1/admin/change-requests/"+cr+"/approve").with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRequestVersion\":0}")).andReturn().getResponse().getStatus();
  int revisions=jdbc.queryForObject("select count(*) from interview_revision where interview_id=?",Integer.class,s.interview);
  System.out.println("AUDIT approved_update HTTP="+approved+" prior_revision_count="+revisions);assertThat(approved).isEqualTo(200);assertThat(revisions).isEqualTo(1);
  JsonNode old=json.readTree(jdbc.queryForObject("select payload::text from interview_revision where interview_id=?",String.class,s.interview));
  assertThat(old.path("rounds").get(0).path("remark").asText()).isEqualTo("historical-round");
  assertThat(old.path("rounds").get(0).path("interviewDatePrecision").asText()).isEqualTo("YEAR");
  assertThat(old.path("rounds").get(0).path("questions").get(0).path("algorithmTitle").asText()).isEqualTo("original-algorithm");
 }
 @Test void concurrent_submit_should_have_one_snapshot_and_one_winner() throws Exception {
  Sample s=seed(false,false);ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);
  Callable<Integer> action=()->{start.await();return mvc.perform(post("/api/v1/me/interviews/"+s.interview+"/submit").with(user(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andReturn().getResponse().getStatus();};
  try{Future<Integer>a=pool.submit(action),b=pool.submit(action);start.countDown();List<Integer> statuses=List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS));int snaps=jdbc.queryForObject("select count(*) from submission_snapshot where interview_id=?",Integer.class,s.interview);System.out.println("AUDIT concurrent_submit="+statuses+" snapshots="+snaps);assertThat(statuses).containsExactlyInAnyOrder(200,409);assertThat(snaps).isEqualTo(1);}finally{pool.shutdownNow();}
 }

 @Test void approve_move_and_remove_round_should_not_publish_empty_interview() throws Exception {
  Sample s=seed(false,true);publish(s);
  ArrayNode rs=(ArrayNode)s.body.path("rounds");JsonNode moved=rs.get(0).path("questions").get(0);ObjectNode retained=(ObjectNode)rs.get(1);retained.putArray("questions").add(moved);rs.remove(0);
  ObjectNode request=json.createObjectNode().put("type","UPDATE").put("baseVersion",3);ObjectNode payload=s.body.deepCopy();payload.remove("version");request.set("payload",payload);
  var submitted=mvc.perform(put("/api/v1/me/interviews/"+s.interview+"/change-request").with(user(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(request.toString())).andReturn().getResponse();assertThat(submitted.getStatus()).isEqualTo(200);long cr=json.readTree(submitted.getContentAsString()).path("data").path("id").asLong();
  int approved=mvc.perform(post("/api/v1/admin/change-requests/"+cr+"/approve").with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRequestVersion\":0}")).andReturn().getResponse().getStatus();
  String state=jdbc.queryForObject("select status from interview_record where id=?",String.class,s.interview);int qs=jdbc.queryForObject("select count(*) from question q join interview_round r on q.round_id=r.id where r.interview_id=?",Integer.class,s.interview);
  System.out.println("AUDIT published_move_and_remove HTTP="+approved+" status="+state+" question_count="+qs);assertThat(approved).isEqualTo(200);assertThat(qs).isEqualTo(1);
 }
 @Test void moving_followup_then_removing_original_question_and_round_preserves_it() throws Exception {
  Sample s=seed(true,true);ArrayNode rs=(ArrayNode)s.body.path("rounds");JsonNode follow=rs.get(0).path("questions").get(0).path("followUps").get(0);long fid=follow.path("id").asLong();
  ((ObjectNode)rs.get(1).path("questions").get(0)).putArray("followUps").add(follow);rs.remove(0);
  assertThat(save(s,s.body)).isEqualTo(200);assertThat(jdbc.queryForObject("select content from follow_up where id=?",String.class,fid)).isEqualTo("old-follow");
 }

 @Test void null_elements_and_missing_review_version_are_client_errors() throws Exception {
  Sample s=seed(false,false);
  for(String field:List.of("tagIds","proposedTags")) {ObjectNode b=s.body.deepCopy();b.putArray(field).addNull();assertThat(save(s,b)).isEqualTo(400);}
  ObjectNode q=s.body.deepCopy();((ObjectNode)q.path("rounds").get(0)).putArray("questions").addNull();assertThat(save(s,q)).isEqualTo(400);
  ObjectNode f=s.body.deepCopy();((ObjectNode)f.path("rounds").get(0).path("questions").get(0)).putArray("followUps").addNull();assertThat(save(s,f)).isEqualTo(400);
  assertThat(mvc.perform(post("/api/v1/admin/change-requests/1/approve").with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}")).andReturn().getResponse().getStatus()).isEqualTo(400);
  assertThat(jdbc.queryForObject("select version from interview_record where id=?",Long.class,s.interview)).isEqualTo(1);
 }
 @Test void unknown_round_cannot_be_created_or_forged_from_standard_round() throws Exception {
  Sample s=seed(false,false);ObjectNode b=s.body.deepCopy();ObjectNode round=(ObjectNode)b.path("rounds").get(0);round.put("roundType","UNKNOWN");round.putNull("roundNo");assertThat(save(s,b)).isEqualTo(400);round.remove("id");assertThat(save(s,b)).isEqualTo(400);
 }
 @Test void stale_update_cannot_approve_or_reject_new_payload() throws Exception {
  Sample s=seed(false,false);publish(s);long id=upsert(s,"proposal-A");assertThat(upsert(s,"proposal-B")).isEqualTo(id);
  for(String action:List.of("approve","reject")) assertThat(mvc.perform(post("/api/v1/admin/change-requests/"+id+"/"+action).with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRequestVersion\":0}")).andReturn().getResponse().getStatus()).isEqualTo(409);
  assertThat(mvc.perform(post("/api/v1/admin/change-requests/"+id+"/approve").with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRequestVersion\":1}")).andReturn().getResponse().getStatus()).isEqualTo(200);
  assertThat(mvc.perform(get("/api/v1/interviews/"+s.interview)).andReturn().getResponse().getContentAsString()).contains("proposal-B");
 }
 @Test void concurrent_request_approval_has_one_winner_and_one_revision() throws Exception {
  Sample s=seed(false,false);publish(s);long id=upsert(s,"concurrent-proposal");ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);
  Callable<Integer> action=()->{start.await();return mvc.perform(post("/api/v1/admin/change-requests/"+id+"/approve").with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRequestVersion\":0}")).andReturn().getResponse().getStatus();};
  try {Future<Integer>a=pool.submit(action),b=pool.submit(action);start.countDown();assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);assertThat(jdbc.queryForObject("select count(*) from interview_revision where interview_id=?",Integer.class,s.interview)).isEqualTo(1);}finally{pool.shutdownNow();}
 }
 @Test void concurrent_saves_with_new_questions_return_conflict_without_losing_winner() throws Exception {
  Sample s=seed(false,false);ObjectNode a=s.body.deepCopy(),b=s.body.deepCopy();
  ((ArrayNode)a.path("rounds").get(0).path("questions")).insert(0,json.createObjectNode().put("content","new-A"));
  ((ArrayNode)b.path("rounds").get(0).path("questions")).insert(0,json.createObjectNode().put("content","new-B"));
  ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);
  try {Future<Integer> first=pool.submit(()->{start.await();return save(s,a);});Future<Integer> second=pool.submit(()->{start.await();return save(s,b);});start.countDown();assertThat(List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);assertThat(jdbc.queryForObject("select count(*) from question q join interview_round r on r.id=q.round_id where r.interview_id=?",Integer.class,s.interview)).isEqualTo(2);}finally{pool.shutdownNow();}
 }

 @Test void candidate_resolution_and_author_save_use_the_same_root_lock() throws Exception {
  Sample s=seed(false,false);s.body.putArray("proposedTags").add("synthetic-candidate");assertThat(save(s,s.body)).isEqualTo(200);
  assertThat(mvc.perform(post("/api/v1/me/interviews/"+s.interview+"/submit").with(user(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}")).andReturn().getResponse().getStatus()).isEqualTo(200);
  JsonNode detail=json.readTree(mvc.perform(get("/api/v1/admin/reviews/interviews/"+s.interview).with(admin(s.user))).andReturn().getResponse().getContentAsString());long cid=detail.path("data").path("candidates").get(0).path("id").asLong();s.body.put("version",3);
  ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);
  try {Future<Integer>a=pool.submit(()->{start.await();return save(s,s.body);});Future<Integer>b=pool.submit(()->{start.await();return mvc.perform(post("/api/v1/admin/reviews/interviews/"+s.interview+"/candidates/"+cid+"/resolve").with(admin(s.user)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":3,\"action\":\"REMOVE\"}")).andReturn().getResponse().getStatus();});start.countDown();assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);}finally{pool.shutdownNow();}
 }
}
